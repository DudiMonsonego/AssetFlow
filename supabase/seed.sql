-- =============================================================================
-- AssetFlow — Development Seed Data
-- Run AFTER the migration: supabase db reset (which auto-runs seed.sql)
-- =============================================================================
-- NOTE: This seed creates demo data only. Do NOT run in production.
-- Auth users must be created separately via Supabase Auth or the dashboard.
-- =============================================================================

-- ─── Demo Organization ───────────────────────────────────────────────────────

INSERT INTO organizations (id, name, subscription_status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Acme Corp',       'active'),
  ('00000000-0000-0000-0000-000000000002', 'Beta Industries', 'trial');


-- ─── Demo Assets for Acme Corp ───────────────────────────────────────────────

INSERT INTO assets (
  organization_id, serial_number, model_name, manufacturer,
  category, status, purchase_date, warranty_expiry, purchase_price, location
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'SN-LAPTOP-001', 'ThinkPad X1 Carbon', 'Lenovo',
    'Laptop', 'active', '2023-01-15', '2026-01-15', 1299.00, 'HQ - Floor 2'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'SN-LAPTOP-002', 'MacBook Pro 14"', 'Apple',
    'Laptop', 'active', '2023-03-20', '2026-03-20', 1999.00, 'HQ - Floor 3'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'SN-SERVER-001', 'PowerEdge R740', 'Dell',
    'Server', 'active', '2022-06-01', '2025-06-01', 8500.00, 'Data Center - Rack A'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'SN-PRINTER-001', 'LaserJet Pro M404n', 'HP',
    'Printer', 'in_maintenance', '2021-09-10', '2024-09-10', 350.00, 'HQ - Floor 1'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'SN-MONITOR-001', 'UltraSharp U2722D', 'Dell',
    'Monitor', 'active', '2023-07-05', '2026-07-05', 499.00, 'HQ - Floor 2'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'SN-LAPTOP-003', 'EliteBook 840 G9', 'HP',
    'Laptop', 'retired', '2019-04-12', '2022-04-12', 1100.00, 'Storage Room'
  );


-- ─── Demo Maintenance Logs ───────────────────────────────────────────────────

INSERT INTO maintenance_logs (
  asset_id, organization_id, service_date, description,
  technician_name, cost, next_service_date
)
SELECT
  a.id,
  a.organization_id,
  '2024-03-15',
  'Annual hardware inspection and dust cleaning.',
  'John Martinez',
  75.00,
  '2025-03-15'
FROM assets a
WHERE a.serial_number = 'SN-SERVER-001';

INSERT INTO maintenance_logs (
  asset_id, organization_id, service_date, description,
  technician_name, cost, next_service_date
)
SELECT
  a.id,
  a.organization_id,
  '2024-11-02',
  'Paper jam repair and roller replacement.',
  'Sarah Kim',
  120.00,
  NULL
FROM assets a
WHERE a.serial_number = 'SN-PRINTER-001';
