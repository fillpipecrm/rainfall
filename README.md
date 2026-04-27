# Rainfall Go Web

This project is a migration-ready rebuild path for the legacy `Rainfall Go.fp7` FileMaker database into a modern web app backed by PostgreSQL.

The original `.fp7` files were the starting point, but the rebuild now also has direct evidence from the newer estimating workbooks:

- `Rainfall Solutions`
- `Irrigation Estimating Data Form REF 20110417c.xlsx`
- `Total Zones`
- `Irrigation Estimating Data Form updated 9-12-2022.xlsx`
- `Irrigation Estimating Data Form revised 10-16-2025.xlsm`

The 2025 workbook is especially important because it exposes the real estimating workflow:

- `Data Entry`
- `Client Information`
- `Inventory`
- `Background Data`
- `Notes & Summaries`
- `Proposal`

The broader `Rainfall Solutions` archive also confirms two important migration facts:

- there were multiple version snapshots from at least 2012 through 2014
- a separate `Rainfall Go Pics.fp7` / `Rainfall Server Pics.fp7` database existed for media assets

## What This Repo Gives You

- An Express app with dashboard, customers, proposals, workbook-based estimating pages, and import visibility pages
- A normalized PostgreSQL schema for irrigation estimating work
- A dedicated media-assets table so the old picture database has a real landing spot
- A generic staging area for raw FileMaker CSV exports
- A CSV import script that stores every source row, then optionally maps known files into first-pass domain tables
- A workbook import script that ingests `.xlsx` and `.xlsm` estimating files directly
- Seed data so the UI has shape before the real exports are available

## Project Layout

- `src/server.js`: web server and HTML views
- `src/db/pool.js`: PostgreSQL connection
- `db/schema.sql`: schema for app tables and raw import staging
- `db/seed.sql`: development seed data
- `scripts/start-postgres.sh`: starts the local Postgres.app-backed server
- `scripts/stop-postgres.sh`: stops the local Postgres.app-backed server
- `scripts/import-filemaker-exports.js`: CSV importer for exported FileMaker tables
- `scripts/import-estimating-workbook.js`: workbook importer for the Excel estimating files

## Migration Workflow

1. Open `Rainfall Go.fp7` in a FileMaker version that can still convert `.fp7` files.
2. Convert it to `.fmp12`.
3. Export each FileMaker table to CSV.
4. Put those CSVs in a local folder such as `./exports`.
5. Load the schema:

```bash
npm install
npm run pg:start
npm run db:schema
npm run db:seed
```

6. Start the app:

```bash
npm run dev
```

## Workbook Import Workflow

The two supplied workbook files are now first-class migration inputs.

Import them with:

```bash
npm run import:workbook -- --file "/Users/briandavidson/Downloads/Irrigation Estimating Data Form updated 9-12-2022.xlsx"
npm run import:workbook -- --file "/Users/briandavidson/Downloads/Irrigation Estimating Data Form revised 10-16-2025.xlsm"
```

That import path stages raw workbook rows into `imports` / `import_rows`, then maps the workbook into:

- `estimate_workbooks`
- `estimate_workbook_sheets`
- `inventory_snapshot_items`
- `estimating_factors`
- `client_field_templates`
- `proposal_note_templates`
- `materials` updates from the workbook inventory sheets

## Local PostgreSQL Setup On This Mac

PostgreSQL has been installed under:

- `/Users/briandavidson/Applications/Postgres.app`

The data directory is:

- `/Users/briandavidson/.local/share/postgres-rainfall-go/data`

Useful commands:

```bash
npm run pg:start
npm run pg:stop
```

The project expects:

```bash
DATABASE_URL=postgresql://briandavidson@localhost:5432/rainfall_go
```

## Netlify Deployment

This project is now wired for Netlify Functions using:

- `netlify/functions/app.js`
- `netlify.toml`
- `serverless-http`

Important constraint:

- Netlify cannot reach your local PostgreSQL server on this Mac.
- For a real deploy, you need a hosted PostgreSQL database such as Neon, Supabase, RDS, or another internet-accessible Postgres instance.

Required Netlify environment variables:

- `DATABASE_URL`
- `DATABASE_SSL=true` for most hosted Postgres providers

Recommended Netlify setup:

- Base directory: repository root
- Build command: `npm run build:netlify`
- Publish directory: `dist`

If you want Netlify to use a modern Node runtime for both the build and functions, set the site’s Node version to `22`.

Typical deploy flow:

```bash
npm run build:netlify
```

Then either:

1. Connect the repo in the Netlify UI and set the build/publish settings above
2. Or use Netlify CLI to initialize and deploy the site

After deploy, set `DATABASE_URL` and `DATABASE_SSL` in the Netlify UI with Functions scope and trigger a new deploy.

7. Stage any export into raw JSON rows:

```bash
node scripts/import-filemaker-exports.js --file ./exports/Customers.csv
```

8. If a CSV clearly matches one of the known domain tables, import directly:

```bash
node scripts/import-filemaker-exports.js --file ./exports/Customers.csv --table customers
node scripts/import-filemaker-exports.js --file ./exports/Properties.csv --table sites
node scripts/import-filemaker-exports.js --file ./exports/Proposals.csv --table proposals
node scripts/import-filemaker-exports.js --file ./exports/Zones.csv --table zones
```

## Known First-Pass Tables

- `customers`
- `sites`
- `proposals`
- `irrigation_systems`
- `zones`
- `materials`
- `proposal_line_items`
- `media_assets`
- `estimate_workbooks`
- `estimate_workbook_sheets`
- `inventory_snapshot_items`
- `estimating_factors`
- `client_field_templates`
- `proposal_note_templates`

## Expected Next Step

Now that real workbooks are available, the next pass should do two things:

1. Import the workbook files and verify the resulting inventory, factors, and note templates in the web UI
2. Add FileMaker CSV exports so workbook logic and legacy data can be merged into a full estimate lifecycle

This scaffold is still conservative, but it is no longer guessing from filenames alone. The workbook-driven estimating model is now explicit, inspectable, and importable.
