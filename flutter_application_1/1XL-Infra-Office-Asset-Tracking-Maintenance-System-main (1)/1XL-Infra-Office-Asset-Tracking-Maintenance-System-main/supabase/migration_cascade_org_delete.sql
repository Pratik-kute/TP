-- ============================================================
-- Migration: ensure every organization_id FK cascades on delete
-- ============================================================
--
-- Why: the super-admin "Delete Organization" button issues a plain
-- DELETE against `organizations`. Older tables (added via
-- migration_add_organizations.sql) reference organizations(id) WITHOUT
-- ON DELETE CASCADE, so the delete fails with a foreign-key error
-- the moment any child row exists.
--
-- What this script does: for every table below, drops the existing
-- FK on `organization_id` (whatever its name happens to be) and
-- re-adds it with ON DELETE CASCADE. Safe to run multiple times.
--
-- Tables NOT touched:
--   - partner_companies.organization_id uses ON DELETE SET NULL on
--     purpose — we want the partner record to survive. Left alone.
--
-- Run in the Supabase SQL editor.

DO $$
DECLARE
  target_tables text[] := ARRAY[
    'users',
    'departments',
    'locations',
    'assets',
    'allocations',
    'maintenance',
    'repairs',
    'vendors',
    'consumables',
    'consumable_allocations',
    'procurements',
    'depreciation',
    'audit_logs',
    'notifications',
    'documents',
    'asset_requests',
    'recoveries',
    'custom_field_definitions',
    'subscriptions',
    'audit_reports',
    'invite_links',
    'deleted_asset_tags',
    'page_access_rules'
  ];
  t text;
  fk_name text;
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    -- Skip tables that don't exist in this database
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'Skipping % (table does not exist)', t;
      CONTINUE;
    END IF;

    -- Skip tables that don't have an organization_id column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id'
    ) THEN
      RAISE NOTICE 'Skipping % (no organization_id column)', t;
      CONTINUE;
    END IF;

    -- Find the FK constraint name on organization_id, if any
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema   = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema   = 'public'
      AND tc.table_name     = t
      AND kcu.column_name   = 'organization_id'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, fk_name);
      RAISE NOTICE 'Dropped FK % on %', fk_name, t;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I
         FOREIGN KEY (organization_id)
         REFERENCES public.organizations(id)
         ON DELETE CASCADE',
      t,
      t || '_organization_id_fkey'
    );
    RAISE NOTICE 'Set ON DELETE CASCADE on %.organization_id', t;
  END LOOP;
END $$;

-- Sanity check — list every FK on organizations(id) and its delete rule.
-- Expected: every row except partner_companies shows delete_rule = 'CASCADE'.
SELECT
  tc.table_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
 AND tc.table_schema   = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
 AND tc.table_schema   = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema   = 'public'
  AND ccu.table_name    = 'organizations'
  AND ccu.column_name   = 'id'
ORDER BY tc.table_name;
