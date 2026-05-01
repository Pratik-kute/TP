-- ============================================================
-- 1XL Asset Tracking & Maintenance System - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ TABLES ============

-- Locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Departments (manager_id FK added after users table)
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  manager_id UUID,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','employee','technician','vendor','auditor')),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  phone TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from departments.manager_id -> users.id
ALTER TABLE departments ADD CONSTRAINT fk_departments_manager
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Vendors
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  services TEXT[] NOT NULL DEFAULT '{}',
  warranty_covered BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(3,1) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assets
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_tag TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('furniture','it_equipment','vehicle','electronics','office_equipment','other')),
  category TEXT NOT NULL CHECK (category IN ('laptop','desktop','monitor','printer','chair','desk','phone','projector','vehicle','server','networking','other')),
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  purchase_date DATE NOT NULL,
  purchase_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  warranty_start DATE,
  warranty_end DATE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','allocated','under_maintenance','retired','disposed')),
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  useful_life_years INTEGER NOT NULL DEFAULT 5,
  salvage_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allocations
CREATE TABLE allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','returned','active')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_date DATE,
  return_date DATE,
  return_condition TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Maintenance
CREATE TABLE maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','overdue','cancelled')),
  type TEXT NOT NULL CHECK (type IN ('preventive','corrective')),
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  checklist TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Repairs
CREATE TABLE repairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  issue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','in_progress','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  parts_used TEXT NOT NULL DEFAULT '',
  labor_hours NUMERIC(6,1) NOT NULL DEFAULT 0,
  completion_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consumables
CREATE TABLE consumables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  last_restocked DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consumable Allocations
CREATE TABLE consumable_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumable_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  date DATE NOT NULL
);

-- Procurements
CREATE TABLE procurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  category TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','ordered','received','rejected','cancelled')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_date DATE,
  expected_delivery DATE,
  received_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Depreciation Records
CREATE TABLE depreciation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  depreciation_amount NUMERIC(12,2) NOT NULL,
  accumulated_depreciation NUMERIC(12,2) NOT NULL,
  book_value NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('straight_line','declining_balance')),
  date DATE NOT NULL
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  entity_type TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('maintenance','repair','allocation','warranty','stock','procurement','system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('warranty','invoice','manual','service_report','purchase_order','other')),
  description TEXT NOT NULL DEFAULT '',
  file_size TEXT NOT NULL DEFAULT '',
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System Config (single row)
CREATE TABLE system_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT '1XL Infrastructure',
  currency TEXT NOT NULL DEFAULT 'USD',
  date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
  maintenance_reminder_days INTEGER NOT NULL DEFAULT 7,
  warranty_alert_days INTEGER NOT NULL DEFAULT 30,
  stock_alert_enabled BOOLEAN NOT NULL DEFAULT true,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line',
  auto_backup_enabled BOOLEAN NOT NULL DEFAULT true,
  backup_frequency TEXT NOT NULL DEFAULT 'weekly'
);

-- Insert default config
INSERT INTO system_config (id) VALUES (1);

-- ============ SEED ADMIN USER ============
INSERT INTO users (name, email, password, role, phone, is_active)
VALUES ('Admin', 'admin', 'Asset@1xl.2026', 'admin', '', true);

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumable_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Allow all operations (internal tool using service_role key)
CREATE POLICY "Allow all" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON departments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON allocations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON maintenance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON repairs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON consumables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON consumable_allocations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON procurements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON depreciation FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON system_config FOR ALL USING (true) WITH CHECK (true);

-- ============ INDEXES ============
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_department ON assets(department_id);
CREATE INDEX idx_assets_location ON assets(location_id);
CREATE INDEX idx_allocations_asset ON allocations(asset_id);
CREATE INDEX idx_allocations_employee ON allocations(employee_id);
CREATE INDEX idx_allocations_status ON allocations(status);
CREATE INDEX idx_maintenance_asset ON maintenance(asset_id);
CREATE INDEX idx_maintenance_status ON maintenance(status);
CREATE INDEX idx_repairs_asset ON repairs(asset_id);
CREATE INDEX idx_repairs_status ON repairs(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_documents_asset ON documents(asset_id);
CREATE INDEX idx_consumables_department ON consumables(department_id);
CREATE INDEX idx_procurements_status ON procurements(status);
