import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { parse } from "csv-parse/sync";

import { pool } from "../src/db/pool.js";

dotenv.config();

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    args[token.slice(2)] = argv[index + 1];
    index += 1;
  }

  return args;
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
}

function pick(row, aliases) {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== "") {
      return row[alias];
    }
  }

  return null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).replaceAll(/[$,]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function toInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

const tableMappers = {
  customers: (row) => ({
    legacy_key: pick(row, ["id", "legacy_id", "customer_id", "record_id"]),
    name: pick(row, ["customer_name", "name", "client", "contact_name"]),
    company: pick(row, ["company", "company_name", "business_name"]),
    email: pick(row, ["email", "email_address"]),
    phone: pick(row, ["phone", "phone_number", "mobile"]),
    billing_notes: pick(row, ["billing_notes", "notes", "customer_notes"]),
  }),
  sites: (row) => ({
    legacy_key: pick(row, ["id", "legacy_id", "site_id", "property_id"]),
    customer_legacy_key: pick(row, ["customer_id", "client_id", "account_id"]),
    name: pick(row, ["site_name", "property_name", "name", "location"]),
    address_1: pick(row, ["address_1", "address", "street"]),
    address_2: pick(row, ["address_2", "suite"]),
    city: pick(row, ["city"]),
    state: pick(row, ["state", "province"]),
    postal_code: pick(row, ["postal_code", "zip", "zip_code"]),
    irrigation_notes: pick(row, ["irrigation_notes", "notes", "site_notes"]),
  }),
  proposals: (row) => ({
    legacy_key: pick(row, ["id", "legacy_id", "proposal_id"]),
    customer_legacy_key: pick(row, ["customer_id", "client_id"]),
    site_legacy_key: pick(row, ["site_id", "property_id"]),
    proposal_number: pick(row, ["proposal_number", "estimate_number", "quote_number"]),
    title: pick(row, ["title", "proposal_title", "description"]),
    status: pick(row, ["status"]),
    proposed_on: toDate(pick(row, ["proposed_on", "proposal_date", "date"])),
    valid_until: toDate(pick(row, ["valid_until", "expiration_date"])),
    subtotal: toNumber(pick(row, ["subtotal", "sub_total"])),
    tax: toNumber(pick(row, ["tax", "sales_tax"])),
    total: toNumber(pick(row, ["total", "grand_total", "proposal_total"])),
    notes: pick(row, ["notes", "proposal_notes"]),
  }),
  irrigation_systems: (row) => ({
    legacy_key: pick(row, ["id", "legacy_id", "system_id"]),
    site_legacy_key: pick(row, ["site_id", "property_id"]),
    water_source: pick(row, ["water_source"]),
    controller_model: pick(row, ["controller_model", "controller"]),
    rain_sensor: pick(row, ["rain_sensor"]),
    backflow_device: pick(row, ["backflow_device", "backflow"]),
    total_zones: toInteger(pick(row, ["total_zones", "zone_count"])),
    estimated_gpm: toNumber(pick(row, ["estimated_gpm", "gpm"])),
    design_notes: pick(row, ["design_notes", "notes"]),
  }),
  zones: (row) => ({
    legacy_key: pick(row, ["id", "legacy_id", "zone_id"]),
    system_legacy_key: pick(row, ["system_id"]),
    site_legacy_key: pick(row, ["site_id", "property_id"]),
    zone_number: toInteger(pick(row, ["zone_number", "zone", "zone_no"])),
    name: pick(row, ["name", "zone_name"]),
    area_name: pick(row, ["area_name", "area", "location"]),
    sprinkler_type: pick(row, ["sprinkler_type", "head_type", "device_type"]),
    nozzle: pick(row, ["nozzle", "nozzle_type"]),
    valve_size: pick(row, ["valve_size"]),
    pipe_size: pick(row, ["pipe_size"]),
    flow_gpm: toNumber(pick(row, ["flow_gpm", "gpm"])),
    precipitation_in_hr: toNumber(
      pick(row, ["precipitation_in_hr", "precipitation_rate", "inches_per_hour"]),
    ),
    runtime_minutes: toInteger(pick(row, ["runtime_minutes", "minutes"])),
    notes: pick(row, ["notes", "zone_notes"]),
  }),
  materials: (row) => ({
    legacy_key: pick(row, ["id", "legacy_id", "material_id"]),
    sku: pick(row, ["sku", "item_code", "part_number"]),
    name: pick(row, ["name", "material_name", "description"]),
    category: pick(row, ["category", "type"]),
    manufacturer: pick(row, ["manufacturer", "brand"]),
    unit: pick(row, ["unit", "uom"]),
    unit_cost: toNumber(pick(row, ["unit_cost", "cost"])),
    unit_price: toNumber(pick(row, ["unit_price", "price"])),
  }),
  proposal_line_items: (row) => ({
    legacy_key: pick(row, ["id", "legacy_id", "line_item_id"]),
    proposal_legacy_key: pick(row, ["proposal_id", "estimate_id"]),
    zone_legacy_key: pick(row, ["zone_id"]),
    material_legacy_key: pick(row, ["material_id", "item_id"]),
    sort_order: toInteger(pick(row, ["sort_order", "line_number", "position"])) ?? 0,
    description: pick(row, ["description", "name", "line_description"]),
    quantity: toNumber(pick(row, ["quantity", "qty"])),
    unit: pick(row, ["unit", "uom"]),
    unit_cost: toNumber(pick(row, ["unit_cost", "cost"])),
    unit_price: toNumber(pick(row, ["unit_price", "price"])),
    extended_price: toNumber(pick(row, ["extended_price", "amount", "line_total"])),
  }),
  media_assets: (row) => ({
    legacy_key: pick(row, ["id", "legacy_id", "asset_id", "image_id"]),
    site_legacy_key: pick(row, ["site_id", "property_id"]),
    proposal_legacy_key: pick(row, ["proposal_id", "estimate_id"]),
    zone_legacy_key: pick(row, ["zone_id"]),
    asset_group: pick(row, ["asset_group", "folder", "category", "album"]),
    file_name: pick(row, ["file_name", "filename", "name", "image_name"]),
    media_type: pick(row, ["media_type", "mime_type", "type", "extension"]),
    file_path: pick(row, ["file_path", "path", "container_path"]),
    caption: pick(row, ["caption", "description", "notes"]),
    sort_order: toInteger(pick(row, ["sort_order", "position", "sequence"])) ?? 0,
  }),
};

async function insertImportRows(client, importId, rows) {
  for (let index = 0; index < rows.length; index += 1) {
    await client.query(
      `
        insert into import_rows (import_id, row_number, payload)
        values ($1, $2, $3::jsonb)
      `,
      [importId, index + 1, JSON.stringify(rows[index])],
    );
  }
}

async function importKnownTable(client, tableName, rows) {
  const mapper = tableMappers[tableName];

  if (!mapper) {
    throw new Error(`Unknown table: ${tableName}`);
  }

  for (const row of rows) {
    if (tableName === "customers") {
      const mapped = mapper(row);
      if (!mapped.name) {
        continue;
      }

      await client.query(
        `
          insert into customers (legacy_key, name, company, email, phone, billing_notes)
          values ($1, $2, $3, $4, $5, $6)
          on conflict (legacy_key) do update set
            name = excluded.name,
            company = excluded.company,
            email = excluded.email,
            phone = excluded.phone,
            billing_notes = excluded.billing_notes,
            updated_at = now()
        `,
        [
          mapped.legacy_key,
          mapped.name,
          mapped.company,
          mapped.email,
          mapped.phone,
          mapped.billing_notes,
        ],
      );
    }

    if (tableName === "sites") {
      const mapped = mapper(row);
      if (!mapped.name) {
        continue;
      }

      const customerId = mapped.customer_legacy_key
        ? (
            await client.query(
              "select id from customers where legacy_key = $1",
              [mapped.customer_legacy_key],
            )
          ).rows[0]?.id ?? null
        : null;

      await client.query(
        `
          insert into sites (
            legacy_key,
            customer_id,
            name,
            address_1,
            address_2,
            city,
            state,
            postal_code,
            irrigation_notes
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (legacy_key) do update set
            customer_id = excluded.customer_id,
            name = excluded.name,
            address_1 = excluded.address_1,
            address_2 = excluded.address_2,
            city = excluded.city,
            state = excluded.state,
            postal_code = excluded.postal_code,
            irrigation_notes = excluded.irrigation_notes,
            updated_at = now()
        `,
        [
          mapped.legacy_key,
          customerId,
          mapped.name,
          mapped.address_1,
          mapped.address_2,
          mapped.city,
          mapped.state,
          mapped.postal_code,
          mapped.irrigation_notes,
        ],
      );
    }

    if (tableName === "proposals") {
      const mapped = mapper(row);
      const customerId = mapped.customer_legacy_key
        ? (
            await client.query(
              "select id from customers where legacy_key = $1",
              [mapped.customer_legacy_key],
            )
          ).rows[0]?.id ?? null
        : null;
      const siteId = mapped.site_legacy_key
        ? (
            await client.query("select id from sites where legacy_key = $1", [
              mapped.site_legacy_key,
            ])
          ).rows[0]?.id ?? null
        : null;

      await client.query(
        `
          insert into proposals (
            legacy_key,
            customer_id,
            site_id,
            proposal_number,
            title,
            status,
            proposed_on,
            valid_until,
            subtotal,
            tax,
            total,
            notes
          )
          values ($1, $2, $3, $4, $5, coalesce($6, 'draft'), $7, $8, $9, $10, $11, $12)
          on conflict (legacy_key) do update set
            customer_id = excluded.customer_id,
            site_id = excluded.site_id,
            proposal_number = excluded.proposal_number,
            title = excluded.title,
            status = excluded.status,
            proposed_on = excluded.proposed_on,
            valid_until = excluded.valid_until,
            subtotal = excluded.subtotal,
            tax = excluded.tax,
            total = excluded.total,
            notes = excluded.notes,
            updated_at = now()
        `,
        [
          mapped.legacy_key,
          customerId,
          siteId,
          mapped.proposal_number,
          mapped.title,
          mapped.status,
          mapped.proposed_on,
          mapped.valid_until,
          mapped.subtotal,
          mapped.tax,
          mapped.total,
          mapped.notes,
        ],
      );
    }

    if (tableName === "irrigation_systems") {
      const mapped = mapper(row);
      const siteId = mapped.site_legacy_key
        ? (
            await client.query("select id from sites where legacy_key = $1", [
              mapped.site_legacy_key,
            ])
          ).rows[0]?.id ?? null
        : null;

      await client.query(
        `
          insert into irrigation_systems (
            legacy_key,
            site_id,
            water_source,
            controller_model,
            rain_sensor,
            backflow_device,
            total_zones,
            estimated_gpm,
            design_notes
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (legacy_key) do update set
            site_id = excluded.site_id,
            water_source = excluded.water_source,
            controller_model = excluded.controller_model,
            rain_sensor = excluded.rain_sensor,
            backflow_device = excluded.backflow_device,
            total_zones = excluded.total_zones,
            estimated_gpm = excluded.estimated_gpm,
            design_notes = excluded.design_notes,
            updated_at = now()
        `,
        [
          mapped.legacy_key,
          siteId,
          mapped.water_source,
          mapped.controller_model,
          mapped.rain_sensor,
          mapped.backflow_device,
          mapped.total_zones,
          mapped.estimated_gpm,
          mapped.design_notes,
        ],
      );
    }

    if (tableName === "zones") {
      const mapped = mapper(row);
      const siteId = mapped.site_legacy_key
        ? (
            await client.query("select id from sites where legacy_key = $1", [
              mapped.site_legacy_key,
            ])
          ).rows[0]?.id ?? null
        : null;
      const systemId = mapped.system_legacy_key
        ? (
            await client.query(
              "select id from irrigation_systems where legacy_key = $1",
              [mapped.system_legacy_key],
            )
          ).rows[0]?.id ?? null
        : null;

      await client.query(
        `
          insert into zones (
            legacy_key,
            system_id,
            site_id,
            zone_number,
            name,
            area_name,
            sprinkler_type,
            nozzle,
            valve_size,
            pipe_size,
            flow_gpm,
            precipitation_in_hr,
            runtime_minutes,
            notes
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          on conflict (legacy_key) do update set
            system_id = excluded.system_id,
            site_id = excluded.site_id,
            zone_number = excluded.zone_number,
            name = excluded.name,
            area_name = excluded.area_name,
            sprinkler_type = excluded.sprinkler_type,
            nozzle = excluded.nozzle,
            valve_size = excluded.valve_size,
            pipe_size = excluded.pipe_size,
            flow_gpm = excluded.flow_gpm,
            precipitation_in_hr = excluded.precipitation_in_hr,
            runtime_minutes = excluded.runtime_minutes,
            notes = excluded.notes,
            updated_at = now()
        `,
        [
          mapped.legacy_key,
          systemId,
          siteId,
          mapped.zone_number,
          mapped.name,
          mapped.area_name,
          mapped.sprinkler_type,
          mapped.nozzle,
          mapped.valve_size,
          mapped.pipe_size,
          mapped.flow_gpm,
          mapped.precipitation_in_hr,
          mapped.runtime_minutes,
          mapped.notes,
        ],
      );
    }

    if (tableName === "materials") {
      const mapped = mapper(row);
      if (!mapped.name) {
        continue;
      }

      await client.query(
        `
          insert into materials (
            legacy_key,
            sku,
            name,
            category,
            manufacturer,
            unit,
            unit_cost,
            unit_price
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
          on conflict (legacy_key) do update set
            sku = excluded.sku,
            name = excluded.name,
            category = excluded.category,
            manufacturer = excluded.manufacturer,
            unit = excluded.unit,
            unit_cost = excluded.unit_cost,
            unit_price = excluded.unit_price,
            updated_at = now()
        `,
        [
          mapped.legacy_key,
          mapped.sku,
          mapped.name,
          mapped.category,
          mapped.manufacturer,
          mapped.unit,
          mapped.unit_cost,
          mapped.unit_price,
        ],
      );
    }

    if (tableName === "proposal_line_items") {
      const mapped = mapper(row);
      if (!mapped.description) {
        continue;
      }

      const proposalId = mapped.proposal_legacy_key
        ? (
            await client.query(
              "select id from proposals where legacy_key = $1",
              [mapped.proposal_legacy_key],
            )
          ).rows[0]?.id ?? null
        : null;
      const zoneId = mapped.zone_legacy_key
        ? (
            await client.query("select id from zones where legacy_key = $1", [
              mapped.zone_legacy_key,
            ])
          ).rows[0]?.id ?? null
        : null;
      const materialId = mapped.material_legacy_key
        ? (
            await client.query("select id from materials where legacy_key = $1", [
              mapped.material_legacy_key,
            ])
          ).rows[0]?.id ?? null
        : null;

      await client.query(
        `
          insert into proposal_line_items (
            legacy_key,
            proposal_id,
            zone_id,
            material_id,
            sort_order,
            description,
            quantity,
            unit,
            unit_cost,
            unit_price,
            extended_price
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          on conflict (legacy_key) do update set
            proposal_id = excluded.proposal_id,
            zone_id = excluded.zone_id,
            material_id = excluded.material_id,
            sort_order = excluded.sort_order,
            description = excluded.description,
            quantity = excluded.quantity,
            unit = excluded.unit,
            unit_cost = excluded.unit_cost,
            unit_price = excluded.unit_price,
            extended_price = excluded.extended_price,
            updated_at = now()
        `,
        [
          mapped.legacy_key,
          proposalId,
          zoneId,
          materialId,
          mapped.sort_order,
          mapped.description,
          mapped.quantity,
          mapped.unit,
          mapped.unit_cost,
          mapped.unit_price,
          mapped.extended_price,
        ],
      );
    }

    if (tableName === "media_assets") {
      const mapped = mapper(row);
      if (!mapped.file_name) {
        continue;
      }

      const siteId = mapped.site_legacy_key
        ? (
            await client.query("select id from sites where legacy_key = $1", [
              mapped.site_legacy_key,
            ])
          ).rows[0]?.id ?? null
        : null;
      const proposalId = mapped.proposal_legacy_key
        ? (
            await client.query(
              "select id from proposals where legacy_key = $1",
              [mapped.proposal_legacy_key],
            )
          ).rows[0]?.id ?? null
        : null;
      const zoneId = mapped.zone_legacy_key
        ? (
            await client.query("select id from zones where legacy_key = $1", [
              mapped.zone_legacy_key,
            ])
          ).rows[0]?.id ?? null
        : null;

      await client.query(
        `
          insert into media_assets (
            legacy_key,
            site_id,
            proposal_id,
            zone_id,
            asset_group,
            file_name,
            media_type,
            file_path,
            caption,
            sort_order
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          on conflict (legacy_key) do update set
            site_id = excluded.site_id,
            proposal_id = excluded.proposal_id,
            zone_id = excluded.zone_id,
            asset_group = excluded.asset_group,
            file_name = excluded.file_name,
            media_type = excluded.media_type,
            file_path = excluded.file_path,
            caption = excluded.caption,
            sort_order = excluded.sort_order,
            updated_at = now()
        `,
        [
          mapped.legacy_key,
          siteId,
          proposalId,
          zoneId,
          mapped.asset_group,
          mapped.file_name,
          mapped.media_type,
          mapped.file_path,
          mapped.caption,
          mapped.sort_order,
        ],
      );
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = args.file;
  const tableName = args.table ?? null;
  const sourceName = args["import-name"] ?? path.basename(filePath ?? "");
  const sourceKind = args["source-kind"] ?? "filemaker-export";

  if (!filePath) {
    throw new Error("Missing --file argument");
  }

  const source = await fs.readFile(filePath, "utf8");
  const parsedRows = parse(source, {
    bom: true,
    columns: (headers) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  if (parsedRows.length === 0) {
    throw new Error("CSV has no data rows");
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    const importResult = await client.query(
      `
        insert into imports (source_name, source_kind, file_name)
        values ($1, $2, $3)
        returning id
      `,
      [sourceName, sourceKind, path.basename(filePath)],
    );

    const importId = importResult.rows[0].id;

    await insertImportRows(client, importId, parsedRows);

    if (tableName) {
      await importKnownTable(client, tableName, parsedRows);
    }

    await client.query("commit");
    console.log(
      `Imported ${parsedRows.length} rows from ${path.basename(filePath)}${
        tableName ? ` into ${tableName}` : ""
      }`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
