-- Schema v16: Add asset_use to assets table
-- Run this in the Supabase SQL Editor.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_use TEXT DEFAULT NULL;

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_use_check;

ALTER TABLE assets ADD CONSTRAINT assets_asset_use_check
  CHECK (asset_use IS NULL OR asset_use IN ('personal', 'common'));

CREATE INDEX IF NOT EXISTS idx_assets_asset_use ON assets(asset_use);
