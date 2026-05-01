-- ============================================================
-- Schema v6: Extended Asset Fields for Bulk Import
-- ============================================================
-- Run this AFTER schema_v3 (and optionally v4, v5).
-- Adds optional IT-specific columns to the assets table
-- to support bulk import from audit Excel spreadsheets.
-- ============================================================

-- Add extended IT/hardware fields to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS processor TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ram TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS storage TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS graphics_card TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS screen_size TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS configuration TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS device_name TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS assigned_employee TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS designation TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS physically_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS mfg_date TEXT NOT NULL DEFAULT '';

-- Add indexes for commonly queried extended fields
CREATE INDEX IF NOT EXISTS idx_assets_assigned_employee ON assets(assigned_employee) WHERE assigned_employee != '';
CREATE INDEX IF NOT EXISTS idx_assets_processor ON assets(processor) WHERE processor != '';
CREATE INDEX IF NOT EXISTS idx_assets_device_name ON assets(device_name) WHERE device_name != '';
