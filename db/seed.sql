insert into customers (legacy_key, name, company, email, phone, billing_notes)
values
  ('cust-1001', 'Eleanor Pritchard', 'Pritchard Farmhouse', 'eleanor@example.com', '518-555-0142', 'Prefers spring startup walkthrough.'),
  ('cust-1002', 'West Hollow HOA', 'West Hollow HOA', 'board@westhollow.example', '518-555-0175', 'Large common-area retrofit project.')
on conflict (legacy_key) do nothing;

insert into sites (legacy_key, customer_id, name, address_1, city, state, postal_code, irrigation_notes)
select
  'site-2001',
  c.id,
  'Pritchard Residence',
  '18 Orchard View Lane',
  'Bennington',
  'VT',
  '05201',
  'Steep rear bed line with mixed spray and drip.'
from customers c
where c.legacy_key = 'cust-1001'
on conflict (legacy_key) do nothing;

insert into sites (legacy_key, customer_id, name, address_1, city, state, postal_code, irrigation_notes)
select
  'site-2002',
  c.id,
  'West Hollow Entrance Beds',
  '400 Hollow Ridge Road',
  'North Adams',
  'MA',
  '01247',
  'Mainline sizing driven by long entrance run.'
from customers c
where c.legacy_key = 'cust-1002'
on conflict (legacy_key) do nothing;

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
select
  'sys-3001',
  s.id,
  'Municipal',
  'Hunter Pro-C',
  'Wireless',
  'Wilkins 975XL',
  6,
  18.4,
  'Initial pass based on mixed shrub beds and front lawn rotors.'
from sites s
where s.legacy_key = 'site-2001'
on conflict (legacy_key) do nothing;

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
select
  'prop-4001',
  c.id,
  s.id,
  'RG-24017',
  'Front lawn and perennial bed irrigation upgrade',
  'sent',
  date '2026-04-18',
  date '2026-05-18',
  8420.00,
  0.00,
  8420.00,
  'Budgetary proposal reconstructed as sample seed data.'
from customers c
join sites s on s.customer_id = c.id
where c.legacy_key = 'cust-1001'
  and s.legacy_key = 'site-2001'
on conflict (legacy_key) do nothing;

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
select
  'zone-5001',
  sys.id,
  s.id,
  1,
  'Front lawn east',
  'Front lawn',
  'Rotor',
  'MP3000',
  '1 in',
  '1 in',
  8.7,
  0.45,
  24,
  'Longest lateral run in the system.'
from irrigation_systems sys
join sites s on s.id = sys.site_id
where sys.legacy_key = 'sys-3001'
on conflict (legacy_key) do nothing;

insert into materials (legacy_key, sku, name, category, manufacturer, unit, unit_cost, unit_price)
values
  ('mat-6001', 'HUN-PRO-C-6', 'Pro-C 6 Station Controller', 'Controller', 'Hunter', 'ea', 118.00, 196.00),
  ('mat-6002', 'RAIN-BIRD-100DV', '1 in DV Valve', 'Valve', 'Rain Bird', 'ea', 18.25, 36.00)
on conflict (legacy_key) do nothing;

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
select
  'line-7001',
  p.id,
  z.id,
  m.id,
  10,
  'Rotor zone assembly and trenching',
  1,
  'ls',
  1450.00,
  2620.00,
  2620.00
from proposals p
join zones z on z.legacy_key = 'zone-5001'
join materials m on m.legacy_key = 'mat-6002'
where p.legacy_key = 'prop-4001'
on conflict (legacy_key) do nothing;

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
select
  'asset-8001',
  s.id,
  p.id,
  z.id,
  'cell usage/G66 Total Zones',
  'G66.png',
  'image/png',
  'legacy/pics/G66.png',
  'Zone reference image reconstructed from the separate picture database clue.',
  1
from sites s
join proposals p on p.site_id = s.id
join zones z on z.site_id = s.id
where s.legacy_key = 'site-2001'
  and p.legacy_key = 'prop-4001'
  and z.legacy_key = 'zone-5001'
on conflict (legacy_key) do nothing;

insert into imports (source_name, source_kind, file_name, notes)
values
  ('seed-sample', 'seed', 'seed.sql', 'Sample batch to demonstrate the migration audit screen.')
on conflict do nothing;
