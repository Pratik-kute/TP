-- ============================================================
-- Schema v10: Configurable Page Access Control
-- Adds per-org role→page permissions as JSONB on organizations.
-- When NULL, the app falls back to hardcoded defaults.
-- Run this AFTER schema_v9_partner_companies.sql in Supabase SQL Editor
-- ============================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS page_permissions JSONB DEFAULT NULL;

-- ============ DONE ============
-- After running this migration:
-- - organizations.page_permissions stores custom role→page mappings
-- - NULL = use app defaults, no migration of existing data needed
-- - Shape: { "manager": ["dashboard","assets",...], "employee": [...], ... }
