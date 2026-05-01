-- ============================================================
-- Schema v7: Add custom_fields JSONB column to assets table
-- Run this AFTER schema_v6
-- ============================================================

-- Add custom_fields JSONB column (nullable, stores arbitrary key-value pairs from Excel imports)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT NULL;

-- Create a GIN index for fast JSONB queries on custom fields
CREATE INDEX IF NOT EXISTS idx_assets_custom_fields ON assets USING GIN (custom_fields) WHERE custom_fields IS NOT NULL;

-- Example queries for custom fields:
-- Find assets with a specific custom field value:
--   SELECT * FROM assets WHERE custom_fields->>'Adapter Type' = 'USB-C';
-- Find assets that have a specific custom field:
--   SELECT * FROM assets WHERE custom_fields ? 'Adapter Type';
-- Get all unique custom field keys across all assets:
--   SELECT DISTINCT jsonb_object_keys(custom_fields) FROM assets WHERE custom_fields IS NOT NULL;
