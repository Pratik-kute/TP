-- ============================================================
-- Migration: Add Multi-Organization Support
-- Run this in Supabase SQL Editor AFTER the initial schema.sql
-- ============================================================

-- Step 1: Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS + policy
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON organizations FOR ALL USING (true) WITH CHECK (true);

-- Step 2: Seed existing organizations
INSERT INTO organizations (id, name, short_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Ventures', 'VENTURES'),
  ('00000000-0000-0000-0000-000000000002', 'Infra', 'INFRA'),
  ('00000000-0000-0000-0000-000000000003', 'Universe', 'UNIVERSE');

-- Step 3: Add organization_id to all entity tables (default to Infra)
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE users SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE departments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE departments SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE departments ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE locations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE locations SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE locations ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE assets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE assets SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE assets ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE allocations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE allocations SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE allocations ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE maintenance SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE maintenance ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE repairs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE repairs SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE repairs ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE vendors SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE vendors ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE consumables ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE consumables SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE consumables ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE consumable_allocations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE consumable_allocations SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE consumable_allocations ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE procurements ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE procurements SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE procurements ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE depreciation ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE depreciation SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE depreciation ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE audit_logs SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE audit_logs ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE notifications SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE notifications ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE documents SET organization_id = '00000000-0000-0000-0000-000000000002' WHERE organization_id IS NULL;
ALTER TABLE documents ALTER COLUMN organization_id SET NOT NULL;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_allocations_org ON allocations(organization_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_org ON maintenance(organization_id);
CREATE INDEX IF NOT EXISTS idx_repairs_org ON repairs(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendors_org ON vendors(organization_id);
CREATE INDEX IF NOT EXISTS idx_consumables_org ON consumables(organization_id);
CREATE INDEX IF NOT EXISTS idx_consumable_allocations_org ON consumable_allocations(organization_id);
CREATE INDEX IF NOT EXISTS idx_procurements_org ON procurements(organization_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_org ON depreciation(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
