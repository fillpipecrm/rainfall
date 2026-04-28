import express from "express";
import path from "node:path";

import { config } from "./config.js";
import { pool } from "./db/pool.js";
import {
  calculateEstimate,
  controllerGroups,
  defaultEstimateInput,
  largeRotorOptions,
  parseEstimateInput,
  rainBirdRotorOptions,
  rotorOptions,
  sprayOptions,
} from "./estimate-engine.js";

const app = express();

app.use(express.urlencoded({ extended: true }));

if (process.env.NETLIFY !== "true") {
  app.use("/public", express.static(path.resolve(process.cwd(), "public")));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function currency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function countLabel(value, noun) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function describeError(error) {
  if (!error) {
    return "Unknown error";
  }

  if (error.message) {
    return error.message;
  }

  if (error.code) {
    return String(error.code);
  }

  return String(error);
}

function renderPage({ title, eyebrow, intro, stats = [], content }) {
  const statsMarkup = stats
    .map(
      (stat) => `
        <article class="stat-card">
          <div class="stat-value">${escapeHtml(stat.value)}</div>
          <div class="stat-label">${escapeHtml(stat.label)}</div>
        </article>
      `,
    )
    .join("");

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <link rel="stylesheet" href="/public/styles.css" />
    </head>
    <body>
      <div class="page-shell">
        <header class="hero">
          <nav class="top-nav">
            <a href="/">Dashboard</a>
            <a href="/builder">Builder</a>
            <a href="/estimating">Estimating</a>
            <a href="/inventory">Inventory</a>
            <a href="/customers">Customers</a>
            <a href="/proposals">Proposals</a>
            <a href="/zones">Zones</a>
            <a href="/assets">Assets</a>
            <a href="/imports">Imports</a>
          </nav>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h1>${escapeHtml(title)}</h1>
          <p class="intro">${escapeHtml(intro)}</p>
          ${
            statsMarkup
              ? `<section class="stats-grid" aria-label="Summary">${statsMarkup}</section>`
              : ""
          }
        </header>
        <main class="content-grid">
          ${content}
        </main>
      </div>
    </body>
  </html>`;
}

async function query(sql, params = []) {
  const client = await pool.connect();

  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

function failurePage(error) {
  return renderPage({
    title: "Database setup required",
    eyebrow: "Rainfall Go",
    intro:
      "The app can start without PostgreSQL, but the schema has not been loaded yet or the database is unavailable.",
    content: `
      <section class="panel">
        <h2>What to run</h2>
        <pre><code>npm install
npm run db:schema
npm run db:seed
npm run dev</code></pre>
      </section>
      <section class="panel">
        <h2>Connection error</h2>
        <pre><code>${escapeHtml(describeError(error))}</code></pre>
      </section>
    `,
  });
}

function inputValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return escapeHtml(String(value));
}

function metricValue(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "n/a";
  }

  return Number(value).toFixed(digits).replace(/\.00$/, "");
}

function renderField({
  label,
  name,
  value,
  type = "text",
  step,
  min,
  placeholder = "",
}) {
  const attributes = [
    `type="${type}"`,
    `name="${name}"`,
    `value="${inputValue(value)}"`,
    step !== undefined ? `step="${step}"` : "",
    min !== undefined ? `min="${min}"` : "",
    placeholder ? `placeholder="${escapeHtml(placeholder)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <input ${attributes} />
    </label>
  `;
}

function renderWorkbookRequiredPage() {
  return renderPage({
    title: "Estimate builder",
    eyebrow: "Workbook import required",
    intro:
      "The builder depends on the imported 2025 estimating workbook so inventory and note logic come from the real spreadsheet structure.",
    content: `
      <section class="panel panel-wide">
        <pre><code>npm run import:workbook -- --file "/Users/briandavidson/Downloads/Irrigation Estimating Data Form revised 10-16-2025.xlsm"</code></pre>
      </section>
    `,
  });
}

function findFactorValue(factors, pattern, fallback) {
  const match = factors.find(
    (row) => row.numeric_value !== null && row.numeric_value !== undefined && pattern.test(row.label ?? ""),
  );
  return match ? Number(match.numeric_value) : fallback;
}

async function loadLatestWorkbookContext() {
  const latestWorkbookResult = await query(`
    select
      ew.id,
      ew.file_name,
      ew.workbook_type,
      ew.version_label,
      ew.workbook_title,
      ew.imported_at
    from estimate_workbooks ew
    order by ew.imported_at desc
    limit 1
  `);

  const latestWorkbook = latestWorkbookResult.rows[0] ?? null;

  if (!latestWorkbook) {
    return null;
  }

  const [inventoryRows, noteTemplates, factorRows] = await Promise.all([
    query(
      `
        select
          row_number,
          category,
          sku,
          description,
          unit_price
        from inventory_snapshot_items
        where workbook_id = $1
        order by row_number asc
      `,
      [latestWorkbook.id],
    ),
    query(
      `
        select description, quantity, priority
        from proposal_note_templates
        where workbook_id = $1
        order by sort_order asc
      `,
      [latestWorkbook.id],
    ),
    query(
      `
        select label, numeric_value
        from estimating_factors
        where workbook_id = $1
          and factor_group = 'background_metrics'
        order by sort_order asc
      `,
      [latestWorkbook.id],
    ),
  ]);

  return {
    workbookId: latestWorkbook.id,
    fileName: latestWorkbook.file_name,
    workbookType: latestWorkbook.workbook_type,
    versionLabel: latestWorkbook.version_label,
    workbookTitle: latestWorkbook.workbook_title,
    importedAt: latestWorkbook.imported_at,
    inventoryRows: inventoryRows.rows,
    noteTemplates: noteTemplates.rows,
    defaults: {
      laborRate: findFactorValue(factorRows.rows, /labor rate/i, 70),
    },
  };
}

async function loadRecentEstimateRuns(limit = 8) {
  const result = await query(
    `
      select
        er.id,
        er.title,
        er.proposal_number,
        er.customer_name,
        er.status,
        er.summary_snapshot ->> 'total' as total,
        ew.file_name,
        er.created_at
      from estimate_runs er
      left join estimate_workbooks ew on ew.id = er.workbook_id
      order by er.created_at desc
      limit $1
    `,
    [limit],
  );

  return result.rows;
}

function renderOptionTable({ title, prefix, options, values }) {
  const rows = options
    .map(
      (option) => `
        <tr>
          <td>${escapeHtml(option.label)}</td>
          <td class="numeric">${metricValue(option.gpm)}</td>
          <td class="numeric table-input-cell">
            <input
              class="table-input"
              type="number"
              name="${escapeHtml(prefix)}_${escapeHtml(option.key)}"
              min="0"
              step="1"
              value="${inputValue(values[option.key] ?? 0)}"
            />
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <section class="panel">
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th class="numeric">GPM</th>
            <th class="numeric">Qty</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderControllerGroup(group, values) {
  const rows = group.slots
    .map(
      (slot) => `
        <tr>
          <td>${escapeHtml(slot.label)}</td>
          <td class="numeric table-input-cell">
            <input
              class="table-input"
              type="number"
              name="controller_${escapeHtml(group.key)}_${escapeHtml(slot.key)}"
              min="0"
              step="1"
              value="${inputValue(values[slot.key] ?? 0)}"
            />
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <article class="record-card">
      <div class="record-topline">
        <h2>${escapeHtml(group.label)}</h2>
        <span class="pill subdued">${escapeHtml(countLabel(group.slots.length, "size"))}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Station size</th>
            <th class="numeric">Qty</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </article>
  `;
}

function renderEstimateBuilderPage({
  workbook,
  input,
  recentEstimates,
  estimate = null,
  savedEstimateId = null,
}) {
  const controllerMarkup = controllerGroups
    .map((group) => renderControllerGroup(group, input.controllers[group.key] ?? {}))
    .join("");
  const recentEstimateMarkup = recentEstimates
    .map(
      (row) => `
        <article class="record-card">
          <div class="record-topline">
            <h2>${escapeHtml(row.proposal_number || "Draft estimate")}</h2>
            <span class="pill">${escapeHtml(row.status)}</span>
          </div>
          <p class="strong">${escapeHtml(row.title)}</p>
          <p>${escapeHtml(row.customer_name || "No customer name saved")}</p>
          <p class="meta">${escapeHtml(
            new Date(row.created_at).toLocaleString("en-US"),
          )}</p>
          <p class="money">${currency(row.total)}</p>
        </article>
      `,
    )
    .join("");
  const resultMarkup = estimate
    ? `
      <section class="panel panel-wide notice-panel">
        <div class="panel-heading">
          <h2>Estimate saved</h2>
          <span class="pill">${escapeHtml(savedEstimateId ? savedEstimateId.slice(0, 8) : "draft")}</span>
        </div>
        <p>${escapeHtml(estimate.title)} totals ${currency(estimate.summary.total)} based on the latest imported workbook inventory.</p>
      </section>
      <section class="panel">
        <h2>Summary</h2>
        <div class="summary-list">
          <div><span>Materials</span><strong>${currency(estimate.summary.materialsSubtotal)}</strong></div>
          <div><span>Labor</span><strong>${currency(estimate.summary.laborCost)}</strong></div>
          <div><span>Tax</span><strong>${currency(estimate.summary.tax)}</strong></div>
          <div><span>Subcontractors</span><strong>${currency(estimate.summary.subcontractors)}</strong></div>
          <div><span>Profit</span><strong>${currency(estimate.summary.profitAmount)}</strong></div>
          <div><span>Total</span><strong>${currency(estimate.summary.total)}</strong></div>
        </div>
      </section>
      <section class="panel">
        <h2>Derived metrics</h2>
        <div class="summary-list">
          <div><span>Spray heads</span><strong>${escapeHtml(estimate.derived.sprayTotal)}</strong></div>
          <div><span>Spray GPM</span><strong>${escapeHtml(metricValue(estimate.derived.sprayGpm))}</strong></div>
          <div><span>Rotor count</span><strong>${escapeHtml(
            estimate.derived.mpRotorTotal +
              estimate.derived.largeRotorTotal +
              estimate.derived.rainBirdTotal,
          )}</strong></div>
          <div><span>Total zones</span><strong>${escapeHtml(estimate.derived.totalZones)}</strong></div>
          <div><span>Dripline feet</span><strong>${escapeHtml(
            metricValue(estimate.derived.driplineTotalFeet),
          )}</strong></div>
          <div><span>Labor hours</span><strong>${escapeHtml(metricValue(estimate.summary.laborHours))}</strong></div>
        </div>
      </section>
      <section class="panel panel-wide">
        <h2>Calculated line items</h2>
        <table>
          <thead>
            <tr>
              <th>Row</th>
              <th>Category</th>
              <th>Part #</th>
              <th>Description</th>
              <th class="numeric">Qty</th>
              <th class="numeric">Unit Price</th>
              <th class="numeric">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${estimate.lineItems
              .map(
                (item) => `
                  <tr>
                    <td>${escapeHtml(item.rowNumber)}</td>
                    <td>${escapeHtml(item.category ?? "Uncategorized")}</td>
                    <td>${escapeHtml(item.sku ?? "n/a")}</td>
                    <td>${escapeHtml(item.description)}</td>
                    <td class="numeric">${escapeHtml(metricValue(item.quantity))}</td>
                    <td class="numeric">${currency(item.unitPrice)}</td>
                    <td class="numeric">${currency(item.lineTotal)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </section>
      <section class="panel panel-wide">
        <h2>Proposal notes carried from workbook</h2>
        <div class="tag-grid">
          ${estimate.noteTemplates.length
            ? estimate.noteTemplates
                .map(
                  (note) => `
                    <article class="record-card">
                      <p class="strong">${escapeHtml(note.description)}</p>
                      <p class="meta">Priority ${escapeHtml(note.priority ?? "n/a")} · Qty ${escapeHtml(
                        note.quantity ?? "n/a",
                      )}</p>
                    </article>
                  `,
                )
                .join("")
            : "<p>No note templates matched this workbook.</p>"}
        </div>
      </section>
    `
    : "";

  return renderPage({
    title: "Estimate builder",
    eyebrow: workbook.fileName,
    intro:
      "This is the first workbook-driven estimate flow: enter field quantities, map them through the imported inventory sheet, and save the result as a draft estimate in PostgreSQL.",
    stats: [
      {
        value: workbook.versionLabel || "n/a",
        label: "workbook version",
      },
      {
        value: workbook.inventoryRows.length,
        label: countLabel(workbook.inventoryRows.length, "inventory row"),
      },
      {
        value: recentEstimates.length,
        label: countLabel(recentEstimates.length, "saved estimate"),
      },
    ],
    content: `
      ${resultMarkup}
      <section class="panel panel-wide">
        <div class="panel-heading">
          <h2>Project and pricing inputs</h2>
          <span class="pill subdued">Labor default ${currency(workbook.defaults.laborRate)}</span>
        </div>
        <form method="post" class="builder-form">
          <div class="form-grid">
            ${renderField({ label: "Estimate title", name: "title", value: input.title, placeholder: "Maple Street retrofit" })}
            ${renderField({ label: "Proposal number", name: "proposalNumber", value: input.proposalNumber, placeholder: "RG-26001" })}
            ${renderField({ label: "Client name", name: "clientName", value: input.clientName })}
            ${renderField({ label: "Address", name: "address1", value: input.address1 })}
            ${renderField({ label: "City", name: "city", value: input.city })}
            ${renderField({ label: "State", name: "state", value: input.state })}
            ${renderField({ label: "Postal code", name: "postalCode", value: input.postalCode })}
            ${renderField({ label: "Phone", name: "phone", value: input.phone })}
            ${renderField({ label: "Email", name: "email", value: input.email, type: "email" })}
            ${renderField({ label: "Working GPM", name: "workingGpm", value: input.workingGpm, type: "number", min: 0, step: "0.1" })}
            ${renderField({ label: "Labor rate", name: "laborRate", value: input.laborRate, type: "number", min: 0, step: "0.01" })}
            ${renderField({ label: "Tax rate", name: "taxRate", value: input.taxRate, type: "number", min: 0, step: "0.0001" })}
            ${renderField({ label: "Profit margin", name: "profitMargin", value: input.profitMargin, type: "number", min: 0, step: "0.0001" })}
            ${renderField({ label: "Electrician fee", name: "electricianFee", value: input.electricianFee, type: "number", min: 0, step: "0.01" })}
            ${renderField({ label: "Plumber fee", name: "plumberFee", value: input.plumberFee, type: "number", min: 0, step: "0.01" })}
            ${renderField({ label: "Additional labor hours", name: "additionalLaborHours", value: input.additionalLaborHours, type: "number", min: 0, step: "0.1" })}
            ${renderField({ label: "Drip area sq ft", name: "dripAreaSqFt", value: input.dripAreaSqFt, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Drip zones", name: "dripZoneCount", value: input.dripZoneCount, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Tree rings", name: "treeRingCount", value: input.treeRingCount, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "12 in spray heads", name: "spray12Tall", value: input.spray12Tall, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "6 in spray heads", name: "spray6Tall", value: input.spray6Tall, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "12 in stream rotors", name: "stream12Tall", value: input.stream12Tall, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "6 in stream rotors", name: "stream6Tall", value: input.stream6Tall, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Tall large rotors", name: "largeRotorTall", value: input.largeRotorTall, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Yard faucets", name: "yardFaucetCount", value: input.yardFaucetCount, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Rain switches", name: "rainSwitchCount", value: input.rainSwitchCount, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Filter assemblies", name: "filterRequiredCount", value: input.filterRequiredCount, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Booster pumps", name: "boosterPumpCount", value: input.boosterPumpCount, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Drip level 1 feet", name: "drip_level1", value: input.dripLengths.level1, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Drip level 2 feet", name: "drip_level2", value: input.dripLengths.level2, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Drip level 3 feet", name: "drip_level3", value: input.dripLengths.level3, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "Drip level 4 feet", name: "drip_level4", value: input.dripLengths.level4, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "1 in mainline feet", name: "mainline_one", value: input.mainlineFeet.one, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "1.25 in mainline feet", name: "mainline_one_quarter", value: input.mainlineFeet.oneQuarter, type: "number", min: 0, step: "1" })}
            ${renderField({ label: "1.5 in mainline feet", name: "mainline_one_half", value: input.mainlineFeet.oneHalf, type: "number", min: 0, step: "1" })}
          </div>

          <div class="content-grid builder-sections">
            ${renderOptionTable({ title: "Spray heads", prefix: "spray", options: sprayOptions, values: input.spray })}
            ${renderOptionTable({ title: "MP rotors", prefix: "rotor", options: rotorOptions, values: input.rotor })}
            ${renderOptionTable({ title: "Large rotors", prefix: "large_rotor", options: largeRotorOptions, values: input.largeRotor })}
            ${renderOptionTable({ title: "Rain Bird rotors", prefix: "rainbird_rotor", options: rainBirdRotorOptions, values: input.rainBirdRotor })}

            <section class="panel">
              <h2>Backflow devices</h2>
              <div class="form-grid compact-grid">
                ${renderField({ label: '850 3/4"', name: "backflow_febco850_34", value: input.backflow.febco850_34, type: "number", min: 0, step: "1" })}
                ${renderField({ label: '850 1"', name: "backflow_febco850_1", value: input.backflow.febco850_1, type: "number", min: 0, step: "1" })}
                ${renderField({ label: '765 3/4"', name: "backflow_febco765_34", value: input.backflow.febco765_34, type: "number", min: 0, step: "1" })}
                ${renderField({ label: '765 1"', name: "backflow_febco765_1", value: input.backflow.febco765_1, type: "number", min: 0, step: "1" })}
                ${renderField({ label: '825 3/4"', name: "backflow_febco825_34", value: input.backflow.febco825_34, type: "number", min: 0, step: "1" })}
                ${renderField({ label: '825 1"', name: "backflow_febco825_1", value: input.backflow.febco825_1, type: "number", min: 0, step: "1" })}
              </div>
            </section>

            <section class="panel">
              <h2>Wire and decoders</h2>
              <div class="form-grid compact-grid">
                ${renderField({ label: "18/13 wire feet", name: "wire_wire18_13", value: input.wireFeet.wire18_13, type: "number", min: 0, step: "1" })}
                ${renderField({ label: "18/9 wire feet", name: "wire_wire18_9", value: input.wireFeet.wire18_9, type: "number", min: 0, step: "1" })}
                ${renderField({ label: "18/7 wire feet", name: "wire_wire18_7", value: input.wireFeet.wire18_7, type: "number", min: 0, step: "1" })}
                ${renderField({ label: "18/5 wire feet", name: "wire_wire18_5", value: input.wireFeet.wire18_5, type: "number", min: 0, step: "1" })}
                ${renderField({ label: "18/3 wire feet", name: "wire_wire18_3", value: input.wireFeet.wire18_3, type: "number", min: 0, step: "1" })}
                ${renderField({ label: "Decoder wire feet", name: "wire_decoder", value: input.wireFeet.decoder, type: "number", min: 0, step: "1" })}
              </div>
            </section>

            <section class="panel panel-wide">
              <div class="panel-heading">
                <h2>Controller counts</h2>
                <span class="pill subdued">Workbook-driven inventory mapping</span>
              </div>
              <div class="cards-grid">
                ${controllerMarkup}
              </div>
            </section>
          </div>

          <div class="form-actions">
            <button type="submit">Calculate and save draft</button>
          </div>
        </form>
      </section>

      <section class="panel panel-wide">
        <div class="panel-heading">
          <h2>Recent saved estimates</h2>
          <span class="pill">${escapeHtml(workbook.workbookTitle || workbook.fileName)}</span>
        </div>
        <div class="cards-grid">
          ${recentEstimateMarkup || "<p>No estimates have been saved yet.</p>"}
        </div>
      </section>
    `,
  });
}

app.get("/healthz", async (_request, response) => {
  try {
    await query("select 1");
    response.json({ ok: true });
  } catch (error) {
    response.status(503).json({ ok: false, error: describeError(error) });
  }
});

app.get("/", async (_request, response) => {
  try {
    const [
      customerCounts,
      proposalCounts,
      zoneCounts,
      assetCounts,
      workbookCounts,
      inventorySnapshotCounts,
      importCounts,
      recentProposals,
      recentWorkbooks,
    ] = await Promise.all([
      query("select count(*)::int as count from customers"),
      query(
        "select count(*)::int as count, coalesce(sum(total), 0)::numeric as total from proposals",
      ),
      query("select count(*)::int as count from zones"),
      query("select count(*)::int as count from media_assets"),
      query("select count(*)::int as count from estimate_workbooks"),
      query("select count(*)::int as count from inventory_snapshot_items"),
      query("select count(*)::int as count from imports"),
      query(`
        select
          proposal_number,
          title,
          status,
          total,
          coalesce(proposed_on::text, 'n/a') as proposed_on
        from proposals
        order by coalesce(proposed_on, current_date) desc, created_at desc
        limit 8
      `),
      query(`
        select
          ew.file_name,
          ew.workbook_type,
          coalesce(ew.version_label, 'n/a') as version_label,
          ew.imported_at,
          (
            select count(*)::int
            from estimate_workbook_sheets ews
            where ews.workbook_id = ew.id
          ) as sheet_count,
          (
            select count(*)::int
            from inventory_snapshot_items isi
            where isi.workbook_id = ew.id
          ) as inventory_count
        from estimate_workbooks ew
        order by ew.imported_at desc
        limit 6
      `),
    ]);

    const proposalRows = recentProposals.rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.proposal_number ?? "Draft")}</td>
            <td>${escapeHtml(row.title ?? "Untitled proposal")}</td>
            <td><span class="pill">${escapeHtml(row.status)}</span></td>
            <td>${escapeHtml(row.proposed_on)}</td>
            <td class="numeric">${currency(row.total)}</td>
          </tr>
        `,
      )
      .join("");

    const workbookRows = recentWorkbooks.rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.file_name)}</td>
            <td>${escapeHtml(row.workbook_type)}</td>
            <td>${escapeHtml(row.version_label)}</td>
            <td class="numeric">${escapeHtml(row.sheet_count)}</td>
            <td class="numeric">${escapeHtml(row.inventory_count)}</td>
          </tr>
        `,
      )
      .join("");

    response.send(
      renderPage({
        title: "Rainfall estimating dashboard",
        eyebrow: "Workbook-aware rebuild",
        intro:
          "A rebuild of the legacy Rainfall system that now understands the newer estimating workbooks as first-class migration inputs.",
        stats: [
          {
            value: customerCounts.rows[0].count,
            label: countLabel(customerCounts.rows[0].count, "customer"),
          },
          {
            value: proposalCounts.rows[0].count,
            label: countLabel(proposalCounts.rows[0].count, "proposal"),
          },
          {
            value: zoneCounts.rows[0].count,
            label: countLabel(zoneCounts.rows[0].count, "zone"),
          },
          {
            value: assetCounts.rows[0].count,
            label: countLabel(assetCounts.rows[0].count, "asset"),
          },
          {
            value: workbookCounts.rows[0].count,
            label: countLabel(workbookCounts.rows[0].count, "workbook"),
          },
          {
            value: inventorySnapshotCounts.rows[0].count,
            label: countLabel(inventorySnapshotCounts.rows[0].count, "inventory row"),
          },
          {
            value: currency(proposalCounts.rows[0].total),
            label: "proposal value",
          },
          {
            value: importCounts.rows[0].count,
            label: countLabel(importCounts.rows[0].count, "import batch"),
          },
        ],
        content: `
          <section class="panel panel-wide">
            <div class="panel-heading">
              <h2>Recent proposals</h2>
              <a href="/proposals">View all</a>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Proposal</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th class="numeric">Total</th>
                </tr>
              </thead>
              <tbody>${proposalRows}</tbody>
            </table>
          </section>
          <section class="panel panel-wide">
            <div class="panel-heading">
              <h2>Imported workbooks</h2>
              <a href="/estimating">Open workbook view</a>
            </div>
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Version</th>
                  <th class="numeric">Sheets</th>
                  <th class="numeric">Inventory rows</th>
                </tr>
              </thead>
              <tbody>${workbookRows || "<tr><td colspan='5'>No workbooks imported yet.</td></tr>"}</tbody>
            </table>
          </section>
          <section class="panel">
            <h2>Migration notes</h2>
            <p>The 2025 workbook is now the clearest source for the estimating workflow. It defines inventory, client fields, background rates, summaries, and proposal output.</p>
            <p>FileMaker exports still matter for historical records, but workbook imports now anchor the app around the actual estimating structure instead of inference.</p>
          </section>
        `,
      }),
    );
  } catch (error) {
    response.status(503).send(failurePage(error));
  }
});

app.get("/customers", async (request, response) => {
  const search = request.query.q?.trim() ?? "";

  try {
    const { rows } = await query(
      `
        select
          c.name,
          c.company,
          c.email,
          c.phone,
          count(distinct s.id)::int as site_count,
          count(distinct p.id)::int as proposal_count
        from customers c
        left join sites s on s.customer_id = c.id
        left join proposals p on p.customer_id = c.id
        where ($1 = '' or c.name ilike $2 or coalesce(c.company, '') ilike $2)
        group by c.id
        order by c.name asc
      `,
      [search, `%${search}%`],
    );

    const customerMarkup = rows
      .map(
        (row) => `
          <article class="record-card">
            <div class="record-topline">
              <h2>${escapeHtml(row.name)}</h2>
              <span class="pill subdued">${escapeHtml(
                row.company || "Residential",
              )}</span>
            </div>
            <p>${escapeHtml(row.email || "no email")}</p>
            <p>${escapeHtml(row.phone || "no phone")}</p>
            <p class="meta">${escapeHtml(
              `${row.site_count} sites • ${row.proposal_count} proposals`,
            )}</p>
          </article>
        `,
      )
      .join("");

    response.send(
      renderPage({
        title: "Customers",
        eyebrow: "CRM",
        intro:
          "Customers carried over from FileMaker or staged for migration into the new quoting workflow.",
        stats: [{ value: rows.length, label: countLabel(rows.length, "customer") }],
        content: `
          <section class="panel panel-wide">
            <form class="search-form" method="get">
              <input type="search" name="q" placeholder="Search customers" value="${escapeHtml(
                search,
              )}" />
              <button type="submit">Search</button>
            </form>
          </section>
          <section class="cards-grid panel-wide">
            ${customerMarkup || "<p>No customers found.</p>"}
          </section>
        `,
      }),
    );
  } catch (error) {
    response.status(503).send(failurePage(error));
  }
});

app.get("/proposals", async (request, response) => {
  const search = request.query.q?.trim() ?? "";

  try {
    const { rows } = await query(
      `
        select
          p.proposal_number,
          p.title,
          p.status,
          p.proposed_on,
          p.total,
          c.name as customer_name,
          s.name as site_name
        from proposals p
        left join customers c on c.id = p.customer_id
        left join sites s on s.id = p.site_id
        where (
          $1 = ''
          or coalesce(p.proposal_number, '') ilike $2
          or coalesce(p.title, '') ilike $2
          or coalesce(c.name, '') ilike $2
        )
        order by coalesce(p.proposed_on, current_date) desc, p.created_at desc
      `,
      [search, `%${search}%`],
    );

    const proposalMarkup = rows
      .map(
        (row) => `
          <article class="record-card">
            <div class="record-topline">
              <h2>${escapeHtml(row.proposal_number || "Draft proposal")}</h2>
              <span class="pill">${escapeHtml(row.status)}</span>
            </div>
            <p class="strong">${escapeHtml(row.title || "Untitled proposal")}</p>
            <p>${escapeHtml(row.customer_name || "No customer linked")}</p>
            <p>${escapeHtml(row.site_name || "No property linked")}</p>
            <p class="meta">${escapeHtml(
              row.proposed_on ? new Date(row.proposed_on).toLocaleDateString("en-US") : "No date",
            )}</p>
            <p class="money">${currency(row.total)}</p>
          </article>
        `,
      )
      .join("");

    response.send(
      renderPage({
        title: "Proposals",
        eyebrow: "Estimating",
        intro:
          "Proposal totals, statuses, and property links live here while the detailed FileMaker calculations are being reassembled.",
        stats: [{ value: rows.length, label: countLabel(rows.length, "proposal") }],
        content: `
          <section class="panel panel-wide">
            <form class="search-form" method="get">
              <input type="search" name="q" placeholder="Search proposals" value="${escapeHtml(
                search,
              )}" />
              <button type="submit">Search</button>
            </form>
          </section>
          <section class="cards-grid panel-wide">
            ${proposalMarkup || "<p>No proposals found.</p>"}
          </section>
        `,
      }),
    );
  } catch (error) {
    response.status(503).send(failurePage(error));
  }
});

app.get("/builder", async (_request, response) => {
  try {
    const workbook = await loadLatestWorkbookContext();

    if (!workbook) {
      response.send(renderWorkbookRequiredPage());
      return;
    }

    const input = defaultEstimateInput();
    input.laborRate = workbook.defaults.laborRate;

    const recentEstimates = await loadRecentEstimateRuns();

    response.send(
      renderEstimateBuilderPage({
        workbook,
        input,
        recentEstimates,
      }),
    );
  } catch (error) {
    response.status(503).send(failurePage(error));
  }
});

app.post("/builder", async (request, response) => {
  const input = parseEstimateInput(request.body);

  try {
    const workbook = await loadLatestWorkbookContext();

    if (!workbook) {
      response.send(renderWorkbookRequiredPage());
      return;
    }

    const estimate = calculateEstimate(input, workbook);
    const client = await pool.connect();
    let savedEstimateId = null;

    try {
      await client.query("begin");

      const estimateRunResult = await client.query(
        `
          insert into estimate_runs (
            workbook_id,
            proposal_number,
            title,
            customer_name,
            address_1,
            city,
            state,
            postal_code,
            phone,
            email,
            input_snapshot,
            derived_snapshot,
            summary_snapshot
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11::jsonb,
            $12::jsonb,
            $13::jsonb
          )
          returning id
        `,
        [
          workbook.workbookId,
          estimate.proposalNumber || null,
          estimate.title,
          input.clientName || null,
          input.address1 || null,
          input.city || null,
          input.state || null,
          input.postalCode || null,
          input.phone || null,
          input.email || null,
          JSON.stringify(input),
          JSON.stringify(estimate.derived),
          JSON.stringify(estimate.summary),
        ],
      );

      savedEstimateId = estimateRunResult.rows[0].id;

      for (const item of estimate.lineItems) {
        await client.query(
          `
            insert into estimate_run_items (
              estimate_run_id,
              row_number,
              category,
              sku,
              description,
              quantity,
              unit_price,
              line_total
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            savedEstimateId,
            item.rowNumber,
            item.category ?? null,
            item.sku ?? null,
            item.description,
            item.quantity,
            item.unitPrice,
            item.lineTotal,
          ],
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const recentEstimates = await loadRecentEstimateRuns();

    response.send(
      renderEstimateBuilderPage({
        workbook,
        input: { ...input, title: estimate.title },
        recentEstimates,
        estimate,
        savedEstimateId,
      }),
    );
  } catch (error) {
    response.status(503).send(failurePage(error));
  }
});

app.get("/zones", async (_request, response) => {
  try {
    const { rows } = await query(`
      select
        z.zone_number,
        z.name,
        z.area_name,
        z.sprinkler_type,
        z.flow_gpm,
        z.runtime_minutes,
        s.name as site_name
      from zones z
      left join sites s on s.id = z.site_id
      order by coalesce(z.zone_number, 9999), z.name asc
      limit 120
    `);

    const zoneMarkup = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.zone_number ?? "")}</td>
            <td>${escapeHtml(row.name ?? "Unnamed zone")}</td>
            <td>${escapeHtml(row.area_name ?? "n/a")}</td>
            <td>${escapeHtml(row.sprinkler_type ?? "n/a")}</td>
            <td class="numeric">${escapeHtml(row.flow_gpm ?? "n/a")}</td>
            <td class="numeric">${escapeHtml(row.runtime_minutes ?? "n/a")}</td>
            <td>${escapeHtml(row.site_name ?? "n/a")}</td>
          </tr>
        `,
      )
      .join("");

    response.send(
      renderPage({
        title: "Irrigation zones",
        eyebrow: "Hydraulics",
        intro:
          "Zone-level data is where the old workbook clues point most strongly, so the first-pass schema gives it dedicated structure.",
        stats: [{ value: rows.length, label: countLabel(rows.length, "zone shown") }],
        content: `
          <section class="panel panel-wide">
            <table>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Name</th>
                  <th>Area</th>
                  <th>Head type</th>
                  <th class="numeric">Flow</th>
                  <th class="numeric">Runtime</th>
                  <th>Property</th>
                </tr>
              </thead>
              <tbody>${zoneMarkup}</tbody>
            </table>
          </section>
        `,
      }),
    );
  } catch (error) {
    response.status(503).send(failurePage(error));
  }
});

app.get("/estimating", async (_request, response) => {
  try {
    const latestWorkbookResult = await query(`
      select
        ew.id,
        ew.file_name,
        ew.workbook_type,
        ew.version_label,
        ew.workbook_title,
        ew.has_macros,
        ew.imported_at
      from estimate_workbooks ew
      order by ew.imported_at desc
      limit 1
    `);

    const latestWorkbook = latestWorkbookResult.rows[0] ?? null;

    if (!latestWorkbook) {
      response.send(
        renderPage({
          title: "Estimating workbook",
          eyebrow: "Workbook import",
          intro:
            "No workbook imports are present yet. Import one of the Excel estimating files to populate this view.",
          content: `
            <section class="panel panel-wide">
              <pre><code>npm run import:workbook -- --file "/Users/briandavidson/Downloads/Irrigation Estimating Data Form revised 10-16-2025.xlsm"</code></pre>
            </section>
          `,
        }),
      );
      return;
    }

    const [sheets, clientFields, factors, noteTemplates] = await Promise.all([
      query(
        `
          select
            sheet_name,
            dimension_ref,
            populated_cell_count,
            nonempty_row_count
          from estimate_workbook_sheets
          where workbook_id = $1
          order by sheet_order asc
        `,
        [latestWorkbook.id],
      ),
      query(
        `
          select field_name
          from client_field_templates
          where workbook_id = $1
          order by sort_order asc
        `,
        [latestWorkbook.id],
      ),
      query(
        `
          select
            factor_group,
            label,
            numeric_value,
            text_value
          from estimating_factors
          where workbook_id = $1
          order by factor_group asc, sort_order asc
          limit 24
        `,
        [latestWorkbook.id],
      ),
      query(
        `
          select
            description,
            quantity,
            priority
          from proposal_note_templates
          where workbook_id = $1
          order by sort_order asc
          limit 18
        `,
        [latestWorkbook.id],
      ),
    ]);

    const sheetMarkup = sheets.rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.sheet_name)}</td>
            <td>${escapeHtml(row.dimension_ref ?? "n/a")}</td>
            <td class="numeric">${escapeHtml(row.populated_cell_count)}</td>
            <td class="numeric">${escapeHtml(row.nonempty_row_count)}</td>
          </tr>
        `,
      )
      .join("");

    const clientFieldMarkup = clientFields.rows
      .map((row) => `<span class="pill subdued">${escapeHtml(row.field_name)}</span>`)
      .join("");

    const factorMarkup = factors.rows
      .map(
        (row) => `
          <article class="record-card">
            <div class="record-topline">
              <h2>${escapeHtml(row.label)}</h2>
              <span class="pill">${escapeHtml(row.factor_group)}</span>
            </div>
            <p>${escapeHtml(
              row.numeric_value ?? row.text_value ?? "No direct value",
            )}</p>
          </article>
        `,
      )
      .join("");

    const noteMarkup = noteTemplates.rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.description)}</td>
            <td class="numeric">${escapeHtml(row.quantity ?? "n/a")}</td>
            <td class="numeric">${escapeHtml(row.priority ?? "n/a")}</td>
          </tr>
        `,
      )
      .join("");

    response.send(
      renderPage({
        title: latestWorkbook.workbook_title || latestWorkbook.file_name,
        eyebrow: "Estimating workbook",
        intro:
          "This view reflects the latest imported estimating workbook and the structures extracted from its sheets.",
        stats: [
          {
            value: latestWorkbook.workbook_type,
            label: "workbook type",
          },
          {
            value: latestWorkbook.version_label || "n/a",
            label: "version label",
          },
          {
            value: latestWorkbook.has_macros ? "Yes" : "No",
            label: "macro-enabled",
          },
        ],
        content: `
          <section class="panel panel-wide">
            <div class="panel-heading">
              <h2>Sheet summary</h2>
              <a href="/inventory">Open inventory</a>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Sheet</th>
                  <th>Range</th>
                  <th class="numeric">Cells</th>
                  <th class="numeric">Rows</th>
                </tr>
              </thead>
              <tbody>${sheetMarkup}</tbody>
            </table>
          </section>
          <section class="panel">
            <h2>Client fields</h2>
            <div class="tag-grid">
              ${clientFieldMarkup || "<p>No client field template imported.</p>"}
            </div>
          </section>
          <section class="panel">
            <h2>Proposal note templates</h2>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="numeric">Qty</th>
                  <th class="numeric">Priority</th>
                </tr>
              </thead>
              <tbody>${noteMarkup || "<tr><td colspan='3'>No note templates imported.</td></tr>"}</tbody>
            </table>
          </section>
          <section class="cards-grid panel-wide">
            ${factorMarkup || "<p>No estimating factors imported.</p>"}
          </section>
        `,
      }),
    );
  } catch (error) {
    response.status(503).send(failurePage(error));
  }
});

app.get("/inventory", async (request, response) => {
  const search = request.query.q?.trim() ?? "";

  try {
    const latestWorkbookResult = await query(`
      select id, file_name
      from estimate_workbooks
      order by imported_at desc
      limit 1
    `);

    const latestWorkbook = latestWorkbookResult.rows[0] ?? null;

    if (!latestWorkbook) {
      response.send(
        renderPage({
          title: "Inventory",
          eyebrow: "Workbook import",
          intro: "No workbook inventory has been imported yet.",
          content: "<section class='panel panel-wide'><p>Import a workbook to populate inventory snapshots.</p></section>",
        }),
      );
      return;
    }

    const { rows } = await query(
      `
        select
          category,
          sku,
          description,
          quantity,
          unit_price,
          total
        from inventory_snapshot_items
        where workbook_id = $1
          and (
            $2 = ''
            or coalesce(sku, '') ilike $3
            or description ilike $3
            or coalesce(category, '') ilike $3
          )
        order by coalesce(category, 'Uncategorized') asc, row_number asc
        limit 180
      `,
      [latestWorkbook.id, search, `%${search}%`],
    );

    const inventoryMarkup = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.category ?? "Uncategorized")}</td>
            <td>${escapeHtml(row.sku ?? "n/a")}</td>
            <td>${escapeHtml(row.description)}</td>
            <td class="numeric">${escapeHtml(row.quantity ?? "n/a")}</td>
            <td class="numeric">${currency(row.unit_price)}</td>
            <td class="numeric">${currency(row.total)}</td>
          </tr>
        `,
      )
      .join("");

    response.send(
      renderPage({
        title: "Inventory snapshot",
        eyebrow: latestWorkbook.file_name,
        intro:
          "This inventory view is derived from the latest imported workbook, not from a guessed schema.",
        stats: [{ value: rows.length, label: countLabel(rows.length, "row shown") }],
        content: `
          <section class="panel panel-wide">
            <form class="search-form" method="get">
              <input type="search" name="q" placeholder="Search inventory" value="${escapeHtml(
                search,
              )}" />
              <button type="submit">Search</button>
            </form>
          </section>
          <section class="panel panel-wide">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Part #</th>
                  <th>Description</th>
                  <th class="numeric">Qty</th>
                  <th class="numeric">Unit Price</th>
                  <th class="numeric">Total</th>
                </tr>
              </thead>
              <tbody>${inventoryMarkup || "<tr><td colspan='6'>No inventory rows found.</td></tr>"}</tbody>
            </table>
          </section>
        `,
      }),
    );
  } catch (error) {
    response.status(503).send(failurePage(error));
  }
});

app.get("/imports", async (_request, response) => {
  try {
    const imports = await query(`
      select
        i.id,
        i.file_name,
        i.source_name,
        i.source_kind,
        i.imported_at,
        count(r.id)::int as row_count
      from imports i
      left join import_rows r on r.import_id = i.id
      group by i.id
      order by i.imported_at desc
    `);

    const importMarkup = imports.rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.file_name)}</td>
            <td>${escapeHtml(row.source_name || "n/a")}</td>
            <td>${escapeHtml(row.source_kind)}</td>
            <td>${escapeHtml(new Date(row.imported_at).toLocaleString("en-US"))}</td>
            <td class="numeric">${escapeHtml(row.row_count)}</td>
          </tr>
        `,
      )
      .join("");

    response.send(
      renderPage({
        title: "Import batches",
        eyebrow: "Migration audit",
        intro:
          "Every CSV row and every workbook row is staged into PostgreSQL before schema-specific mapping happens. That keeps the migration reversible and inspectable.",
        stats: [{ value: imports.rows.length, label: countLabel(imports.rows.length, "batch") }],
        content: `
          <section class="panel panel-wide">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Source</th>
                  <th>Kind</th>
                  <th>Imported</th>
                  <th class="numeric">Rows</th>
                </tr>
              </thead>
              <tbody>${importMarkup || "<tr><td colspan='5'>No imports recorded.</td></tr>"}</tbody>
            </table>
          </section>
        `,
      }),
    );
  } catch (error) {
    response.status(503).send(failurePage(error));
  }
});

app.get("/assets", async (_request, response) => {
  try {
    const { rows } = await query(`
      select
        m.file_name,
        m.media_type,
        m.asset_group,
        m.caption,
        s.name as site_name,
        p.proposal_number
      from media_assets m
      left join sites s on s.id = m.site_id
      left join proposals p on p.id = m.proposal_id
      order by m.sort_order asc, m.created_at desc
      limit 160
    `);

    const assetMarkup = rows
      .map(
        (row) => `
          <article class="record-card">
            <div class="record-topline">
              <h2>${escapeHtml(row.file_name)}</h2>
              <span class="pill subdued">${escapeHtml(row.media_type || "asset")}</span>
            </div>
            <p>${escapeHtml(row.caption || "No caption recorded")}</p>
            <p class="meta">${escapeHtml(
              row.asset_group || "Ungrouped",
            )}</p>
            <p>${escapeHtml(row.site_name || "No property linked")}</p>
            <p>${escapeHtml(
              row.proposal_number ? `Proposal ${row.proposal_number}` : "No proposal linked",
            )}</p>
          </article>
        `,
      )
      .join("");

    response.send(
      renderPage({
        title: "Media assets",
        eyebrow: "Picture database",
        intro:
          "The legacy system kept a separate picture database, so asset metadata is modeled explicitly instead of being buried in container fields.",
        stats: [{ value: rows.length, label: countLabel(rows.length, "asset shown") }],
        content: `
          <section class="cards-grid panel-wide">
            ${assetMarkup || "<p>No assets found.</p>"}
          </section>
        `,
      }),
    );
  } catch (error) {
    response.status(503).send(failurePage(error));
  }
});

export { app };

if (process.env.NETLIFY !== "true") {
  app.listen(config.port, () => {
    console.log(`Rainfall Go Web listening on http://localhost:${config.port}`);
  });
}
