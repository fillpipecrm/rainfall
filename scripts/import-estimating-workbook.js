import path from "node:path";

import dotenv from "dotenv";
import XLSX from "xlsx";

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

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).replaceAll(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).replaceAll(/[$,%]/g, "").replaceAll(",", "").trim();
  if (normalized === "") {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function getCellValue(worksheet, address) {
  const cell = worksheet[address];

  if (!cell) {
    return null;
  }

  if (cell.f) {
    if (cell.v !== undefined && cell.v !== null && cell.v !== "") {
      return cell.v;
    }

    if (cell.w) {
      return cell.w;
    }

    return `=${cell.f}`;
  }

  if (cell.v !== undefined && cell.v !== null && cell.v !== "") {
    return cell.v;
  }

  if (cell.w) {
    return cell.w;
  }

  return null;
}

function getCellText(worksheet, address) {
  return normalizeText(getCellValue(worksheet, address));
}

function detectWorkbookType(sheetNames) {
  if (sheetNames.includes("Data Entry") && sheetNames.includes("Inventory")) {
    return "estimating-system";
  }

  if (sheetNames.includes("Inventory List")) {
    return "inventory-list";
  }

  return "workbook";
}

function extractVersionLabel(fileName) {
  const matched = fileName.match(/(\d{1,2}-\d{1,2}-\d{4}|\d{4})/);
  return matched ? matched[1] : null;
}

function buildSheetRows(worksheet) {
  const rangeRef = worksheet["!ref"] ?? "A1:A1";
  const range = XLSX.utils.decode_range(rangeRef);
  const rows = [];
  let populatedCellCount = 0;

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const cells = {};

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const value = getCellValue(worksheet, address);

      if (value === null || value === undefined || value === "") {
        continue;
      }

      cells[XLSX.utils.encode_col(columnIndex)] = value;
      populatedCellCount += 1;
    }

    if (Object.keys(cells).length > 0) {
      rows.push({
        excelRowNumber: rowIndex + 1,
        cells,
      });
    }
  }

  return {
    dimensionRef: rangeRef,
    populatedCellCount,
    rows,
  };
}

async function insertRawWorkbookRows(client, importId, workbookRowsBySheet) {
  let rowCounter = 0;

  for (const [sheetName, workbookRows] of workbookRowsBySheet) {
    for (const workbookRow of workbookRows.rows) {
      rowCounter += 1;
      await client.query(
        `
          insert into import_rows (import_id, row_number, payload)
          values ($1, $2, $3::jsonb)
        `,
        [
          importId,
          rowCounter,
          JSON.stringify({
            sheet_name: sheetName,
            excel_row_number: workbookRow.excelRowNumber,
            cells: workbookRow.cells,
          }),
        ],
      );
    }
  }
}

async function insertWorkbookSheets(client, workbookId, workbookRowsBySheet) {
  let sheetOrder = 0;

  for (const [sheetName, workbookRows] of workbookRowsBySheet) {
    sheetOrder += 1;
    await client.query(
      `
        insert into estimate_workbook_sheets (
          workbook_id,
          sheet_name,
          sheet_order,
          dimension_ref,
          populated_cell_count,
          nonempty_row_count,
          preview
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        workbookId,
        sheetName,
        sheetOrder,
        workbookRows.dimensionRef,
        workbookRows.populatedCellCount,
        workbookRows.rows.length,
        JSON.stringify(workbookRows.rows.slice(0, 6)),
      ],
    );
  }
}

async function importInventoryRows(client, workbookId, worksheet, sheetName) {
  const headerC = getCellText(worksheet, "C2");
  const quantityColumn = headerC === "Quant" ? "C" : "D";
  const unitPriceColumn = headerC === "Unit Price" ? "C" : "D";
  const totalColumn = "E";
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  let category = null;

  for (let row = 3; row <= range.e.r + 1; row += 1) {
    const columnA = getCellText(worksheet, `A${row}`);
    const columnB = getCellText(worksheet, `B${row}`);

    if (columnA && !columnB) {
      category = columnA;
      continue;
    }

    if (!columnB) {
      continue;
    }

    const sku = columnA;
    const description = columnB;
    const quantity = toNumber(getCellValue(worksheet, `${quantityColumn}${row}`));
    const unitPrice = toNumber(getCellValue(worksheet, `${unitPriceColumn}${row}`));
    const total = toNumber(getCellValue(worksheet, `${totalColumn}${row}`));
    const legacyKey = `inventory:${slugify(sku || description)}`;

    await client.query(
      `
        insert into materials (legacy_key, sku, name, category, unit_price, unit_cost)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (legacy_key) do update set
          sku = excluded.sku,
          name = excluded.name,
          category = excluded.category,
          unit_price = excluded.unit_price,
          unit_cost = excluded.unit_cost,
          updated_at = now()
      `,
      [legacyKey, sku, description, category, unitPrice, unitPrice],
    );

    await client.query(
      `
        insert into inventory_snapshot_items (
          workbook_id,
          source_sheet,
          row_number,
          category,
          sku,
          description,
          quantity,
          unit_price,
          total
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [workbookId, sheetName, row, category, sku, description, quantity, unitPrice, total],
    );
  }
}

async function importClientFieldTemplate(client, workbookId, worksheet, sheetName) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  let sortOrder = 0;

  for (let row = 1; row <= range.e.r + 1; row += 1) {
    const fieldName = getCellText(worksheet, `A${row}`);

    if (!fieldName || fieldName === "Client Information") {
      continue;
    }

    sortOrder += 1;
    await client.query(
      `
        insert into client_field_templates (workbook_id, source_sheet, field_name, sort_order)
        values ($1, $2, $3, $4)
      `,
      [workbookId, sheetName, fieldName, sortOrder],
    );
  }
}

async function importBackgroundFactors(client, workbookId, worksheet, sheetName) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  let sortOrder = 0;

  for (let row = 3; row <= range.e.r + 1; row += 1) {
    const factorKey = getCellText(worksheet, `A${row}`);

    if (factorKey) {
      sortOrder += 1;
      await client.query(
        `
          insert into estimating_factors (
            workbook_id,
            source_sheet,
            factor_group,
            factor_key,
            label,
            numeric_value,
            payload,
            sort_order
          )
          values ($1, $2, 'nozzle_rates', $3, $4, $5, $6::jsonb, $7)
        `,
        [
          workbookId,
          sheetName,
          factorKey,
          factorKey,
          toNumber(getCellValue(worksheet, `C${row}`)),
          JSON.stringify({
            pipe_total: toNumber(getCellValue(worksheet, `B${row}`)),
            gpm_per_sprinkler: toNumber(getCellValue(worksheet, `C${row}`)),
            pipe_length_per_sprinkler: toNumber(getCellValue(worksheet, `D${row}`)),
            computed_total: toNumber(getCellValue(worksheet, `E${row}`)),
          }),
          sortOrder,
        ],
      );
    }

    const label = getCellText(worksheet, `H${row}`);

    if (label) {
      sortOrder += 1;
      await client.query(
        `
          insert into estimating_factors (
            workbook_id,
            source_sheet,
            factor_group,
            label,
            numeric_value,
            payload,
            sort_order
          )
          values ($1, $2, 'background_metrics', $3, $4, $5::jsonb, $6)
        `,
        [
          workbookId,
          sheetName,
          label,
          toNumber(getCellValue(worksheet, `I${row}`)),
          JSON.stringify({
            column_i: getCellValue(worksheet, `I${row}`),
            column_j: getCellValue(worksheet, `J${row}`),
          }),
          sortOrder,
        ],
      );
    }
  }
}

async function importDataEntryFactors(client, workbookId, worksheet, sheetName) {
  for (const row of [4, 5, 6, 7]) {
    const label = getCellText(worksheet, `N${row}`);
    const description = getCellText(worksheet, `O${row}`);

    if (!label || !description) {
      continue;
    }

    await client.query(
      `
        insert into estimating_factors (
          workbook_id,
          source_sheet,
          factor_group,
          factor_key,
          label,
          text_value,
          sort_order
        )
        values ($1, $2, 'dripline_definitions', $3, $4, $5, $6)
      `,
      [workbookId, sheetName, slugify(label), label, description, row],
    );
  }
}

async function importNoteTemplates(client, workbookId, worksheet, sheetName) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");

  for (let row = 5; row <= range.e.r + 1; row += 1) {
    const description = getCellText(worksheet, `B${row}`);

    if (!description) {
      continue;
    }

    await client.query(
      `
        insert into proposal_note_templates (
          workbook_id,
          source_sheet,
          sort_order,
          quantity,
          description,
          priority
        )
        values ($1, $2, $3, $4, $5, $6)
      `,
      [
        workbookId,
        sheetName,
        row,
        toNumber(getCellValue(worksheet, `A${row}`)),
        description,
        toNumber(getCellValue(worksheet, `G${row}`)),
      ],
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = args.file;

  if (!filePath) {
    throw new Error("Missing --file argument");
  }

  const workbook = XLSX.readFile(filePath, {
    cellFormula: true,
    cellNF: false,
    cellHTML: false,
    cellStyles: false,
    cellText: true,
  });
  const fileName = path.basename(filePath);
  const workbookType = detectWorkbookType(workbook.SheetNames);
  const workbookTitle =
    getCellText(workbook.Sheets[workbook.SheetNames[0]], "A1") ?? fileName;
  const versionLabel = extractVersionLabel(fileName);
  const workbookRowsBySheet = new Map();

  for (const sheetName of workbook.SheetNames) {
    workbookRowsBySheet.set(sheetName, buildSheetRows(workbook.Sheets[sheetName]));
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    const importResult = await client.query(
      `
        insert into imports (source_name, source_kind, file_name, notes)
        values ($1, 'estimating-workbook', $2, $3)
        returning id
      `,
      [
        workbookTitle,
        fileName,
        `Workbook import for ${workbook.SheetNames.join(", ")}`,
      ],
    );

    const importId = importResult.rows[0].id;

    await insertRawWorkbookRows(client, importId, workbookRowsBySheet);

    const workbookResult = await client.query(
      `
        insert into estimate_workbooks (
          import_id,
          file_name,
          workbook_type,
          version_label,
          workbook_title,
          has_macros,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        returning id
      `,
      [
        importId,
        fileName,
        workbookType,
        versionLabel,
        workbookTitle,
        path.extname(fileName).toLowerCase() === ".xlsm",
        JSON.stringify({
          sheet_names: workbook.SheetNames,
          source_path: filePath,
        }),
      ],
    );

    const workbookId = workbookResult.rows[0].id;

    await insertWorkbookSheets(client, workbookId, workbookRowsBySheet);

    if (workbook.Sheets.Inventory) {
      await importInventoryRows(client, workbookId, workbook.Sheets.Inventory, "Inventory");
    }

    if (workbook.Sheets["Inventory List"]) {
      await importInventoryRows(
        client,
        workbookId,
        workbook.Sheets["Inventory List"],
        "Inventory List",
      );
    }

    if (workbook.Sheets["Client Information"]) {
      await importClientFieldTemplate(
        client,
        workbookId,
        workbook.Sheets["Client Information"],
        "Client Information",
      );
    }

    if (workbook.Sheets["Background Data"]) {
      await importBackgroundFactors(
        client,
        workbookId,
        workbook.Sheets["Background Data"],
        "Background Data",
      );
    }

    if (workbook.Sheets["Data Entry"]) {
      await importDataEntryFactors(
        client,
        workbookId,
        workbook.Sheets["Data Entry"],
        "Data Entry",
      );
    }

    if (workbook.Sheets["Notes & Summaries"]) {
      await importNoteTemplates(
        client,
        workbookId,
        workbook.Sheets["Notes & Summaries"],
        "Notes & Summaries",
      );
    }

    await client.query("commit");
    console.log(`Imported workbook ${fileName} (${workbookType})`);
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
