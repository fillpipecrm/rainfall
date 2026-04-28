create extension if not exists pgcrypto;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  legacy_key text unique,
  name text not null,
  company text,
  email text,
  phone text,
  billing_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  legacy_key text unique,
  customer_id uuid references customers(id) on delete set null,
  name text not null,
  address_1 text,
  address_2 text,
  city text,
  state text,
  postal_code text,
  irrigation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  legacy_key text unique,
  customer_id uuid references customers(id) on delete set null,
  site_id uuid references sites(id) on delete set null,
  proposal_number text,
  title text,
  status text not null default 'draft',
  proposed_on date,
  valid_until date,
  subtotal numeric(12, 2),
  tax numeric(12, 2),
  total numeric(12, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists proposals_proposal_number_key
  on proposals (proposal_number)
  where proposal_number is not null;

create table if not exists irrigation_systems (
  id uuid primary key default gen_random_uuid(),
  legacy_key text unique,
  site_id uuid references sites(id) on delete set null,
  water_source text,
  controller_model text,
  rain_sensor text,
  backflow_device text,
  total_zones integer,
  estimated_gpm numeric(10, 2),
  design_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zones (
  id uuid primary key default gen_random_uuid(),
  legacy_key text unique,
  system_id uuid references irrigation_systems(id) on delete set null,
  site_id uuid references sites(id) on delete set null,
  zone_number integer,
  name text,
  area_name text,
  sprinkler_type text,
  nozzle text,
  valve_size text,
  pipe_size text,
  flow_gpm numeric(10, 2),
  precipitation_in_hr numeric(10, 2),
  runtime_minutes integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  legacy_key text unique,
  sku text,
  name text not null,
  category text,
  manufacturer text,
  unit text,
  unit_cost numeric(12, 2),
  unit_price numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists proposal_line_items (
  id uuid primary key default gen_random_uuid(),
  legacy_key text unique,
  proposal_id uuid references proposals(id) on delete cascade,
  zone_id uuid references zones(id) on delete set null,
  material_id uuid references materials(id) on delete set null,
  sort_order integer not null default 0,
  description text not null,
  quantity numeric(12, 2),
  unit text,
  unit_cost numeric(12, 2),
  unit_price numeric(12, 2),
  extended_price numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  legacy_key text unique,
  site_id uuid references sites(id) on delete set null,
  proposal_id uuid references proposals(id) on delete set null,
  zone_id uuid references zones(id) on delete set null,
  asset_group text,
  file_name text not null,
  media_type text,
  file_path text,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists imports (
  id uuid primary key default gen_random_uuid(),
  source_name text,
  source_kind text not null default 'filemaker-export',
  file_name text not null,
  header_row integer not null default 1,
  notes text,
  imported_at timestamptz not null default now()
);

create table if not exists estimate_workbooks (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null unique references imports(id) on delete cascade,
  file_name text not null,
  workbook_type text not null,
  version_label text,
  workbook_title text,
  has_macros boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now()
);

create table if not exists estimate_workbook_sheets (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references estimate_workbooks(id) on delete cascade,
  sheet_name text not null,
  sheet_order integer not null,
  dimension_ref text,
  populated_cell_count integer not null default 0,
  nonempty_row_count integer not null default 0,
  preview jsonb,
  created_at timestamptz not null default now(),
  unique (workbook_id, sheet_name)
);

create table if not exists inventory_snapshot_items (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references estimate_workbooks(id) on delete cascade,
  source_sheet text not null,
  row_number integer not null,
  category text,
  sku text,
  description text not null,
  quantity numeric(12, 2),
  unit_price numeric(12, 2),
  total numeric(12, 2),
  created_at timestamptz not null default now()
);

create table if not exists estimating_factors (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references estimate_workbooks(id) on delete cascade,
  source_sheet text not null,
  factor_group text not null,
  factor_key text,
  label text not null,
  numeric_value numeric(12, 4),
  text_value text,
  unit text,
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists client_field_templates (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references estimate_workbooks(id) on delete cascade,
  source_sheet text not null default 'Client Information',
  field_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists proposal_note_templates (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references estimate_workbooks(id) on delete cascade,
  source_sheet text not null,
  sort_order integer not null default 0,
  quantity numeric(12, 2),
  description text not null,
  priority numeric(12, 2),
  created_at timestamptz not null default now()
);

create table if not exists estimate_runs (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid references estimate_workbooks(id) on delete set null,
  proposal_number text,
  title text not null,
  status text not null default 'draft',
  customer_name text,
  address_1 text,
  city text,
  state text,
  postal_code text,
  phone text,
  email text,
  input_snapshot jsonb not null default '{}'::jsonb,
  derived_snapshot jsonb not null default '{}'::jsonb,
  summary_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists estimate_run_items (
  id uuid primary key default gen_random_uuid(),
  estimate_run_id uuid not null references estimate_runs(id) on delete cascade,
  row_number integer,
  category text,
  sku text,
  description text not null,
  quantity numeric(12, 2),
  unit_price numeric(12, 2),
  line_total numeric(12, 2),
  created_at timestamptz not null default now()
);

create table if not exists import_rows (
  id bigint generated always as identity primary key,
  import_id uuid not null references imports(id) on delete cascade,
  row_number integer not null,
  payload jsonb not null
);

create index if not exists customers_name_idx on customers (name);
create index if not exists sites_customer_id_idx on sites (customer_id);
create index if not exists proposals_customer_id_idx on proposals (customer_id);
create index if not exists proposals_site_id_idx on proposals (site_id);
create index if not exists zones_site_id_idx on zones (site_id);
create index if not exists proposal_line_items_proposal_id_idx on proposal_line_items (proposal_id);
create index if not exists media_assets_site_id_idx on media_assets (site_id);
create index if not exists estimate_workbook_sheets_workbook_id_idx
  on estimate_workbook_sheets (workbook_id);
create index if not exists inventory_snapshot_items_workbook_id_idx
  on inventory_snapshot_items (workbook_id);
create index if not exists inventory_snapshot_items_sku_idx
  on inventory_snapshot_items (sku);
create index if not exists estimating_factors_workbook_id_idx
  on estimating_factors (workbook_id);
create index if not exists client_field_templates_workbook_id_idx
  on client_field_templates (workbook_id);
create index if not exists proposal_note_templates_workbook_id_idx
  on proposal_note_templates (workbook_id);
create index if not exists estimate_runs_workbook_id_idx
  on estimate_runs (workbook_id);
create index if not exists estimate_runs_created_at_idx
  on estimate_runs (created_at desc);
create index if not exists estimate_run_items_estimate_run_id_idx
  on estimate_run_items (estimate_run_id);
create index if not exists import_rows_import_id_idx on import_rows (import_id);
