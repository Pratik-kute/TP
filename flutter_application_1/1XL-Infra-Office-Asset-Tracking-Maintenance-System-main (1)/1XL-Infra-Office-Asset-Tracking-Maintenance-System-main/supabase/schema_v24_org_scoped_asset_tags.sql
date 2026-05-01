-- ============================================================
-- Migration v24: Scope asset-tag uniqueness per organization
-- ------------------------------------------------------------
-- Run this in the Supabase SQL Editor on existing databases.
-- ------------------------------------------------------------
-- Why: the original schema declared `asset_tag TEXT NOT NULL UNIQUE`
-- on both `assets` and `deleted_asset_tags`, which made tags globally
-- unique across every organization. That broke multi-tenant isolation
-- — bulk imports (and single-asset creates) failed when ANOTHER tenant
-- happened to be using the same tag. After this migration, the same
-- asset_tag may exist in multiple organizations, but is still unique
-- WITHIN a given organization.
-- ============================================================

-- 1. Drop the global UNIQUE constraint on assets.asset_tag.
--    The original column-level UNIQUE generates a constraint named
--    `assets_asset_tag_key`. We also defensively scan pg_constraint in
--    case it was renamed.
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_tag_key;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'assets'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(asset_tag)%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%organization_id%'
  LOOP
    EXECUTE format('ALTER TABLE assets DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 2. Drop the global UNIQUE constraint on deleted_asset_tags.asset_tag.
ALTER TABLE deleted_asset_tags DROP CONSTRAINT IF EXISTS deleted_asset_tags_asset_tag_key;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'deleted_asset_tags'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(asset_tag)%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%organization_id%'
  LOOP
    EXECUTE format('ALTER TABLE deleted_asset_tags DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 3. Add composite UNIQUE (organization_id, asset_tag) on both tables.
--    Idempotent — skips if the constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_org_asset_tag_key'
      AND conrelid = 'assets'::regclass
  ) THEN
    ALTER TABLE assets
      ADD CONSTRAINT assets_org_asset_tag_key UNIQUE (organization_id, asset_tag);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deleted_asset_tags_org_asset_tag_key'
      AND conrelid = 'deleted_asset_tags'::regclass
  ) THEN
    ALTER TABLE deleted_asset_tags
      ADD CONSTRAINT deleted_asset_tags_org_asset_tag_key UNIQUE (organization_id, asset_tag);
  END IF;
END $$;
