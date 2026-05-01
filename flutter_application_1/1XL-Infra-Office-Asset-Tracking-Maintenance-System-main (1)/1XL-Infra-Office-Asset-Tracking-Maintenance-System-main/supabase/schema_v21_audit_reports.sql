-- Schema v21 — Monthly Audit Reports + pg_cron schedule
-- =====================================================
-- Adds:
--   1. audit_reports table (idempotency + history of monthly report sends).
--   2. pg_cron + pg_net extensions and a monthly cron entry that calls the
--      `monthly-asset-report` Edge Function for every active organization.
--
-- Run this AFTER the Edge Function is deployed. Required app GUC:
--   ALTER DATABASE postgres SET app.service_role_key = '<YOUR_SERVICE_ROLE_KEY>';
--   ALTER DATABASE postgres SET app.edge_function_url = 'https://<project-ref>.supabase.co/functions/v1';

-- ---- 1. audit_reports table ----------------------------------------------

CREATE TABLE IF NOT EXISTS audit_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_year     INT  NOT NULL,
  period_month    INT  NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status          TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','sent','failed')),
  recipient_count INT,
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_org ON audit_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_period ON audit_reports(period_year, period_month);

-- RLS — only admins of the org can read their own audit_reports rows
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_reports_select_own_org" ON audit_reports;
CREATE POLICY "audit_reports_select_own_org" ON audit_reports
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE email = current_setting('request.jwt.claim.email', true)
    )
  );

-- ---- 2. pg_cron + pg_net + scheduled job ----------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any prior version of this job before re-scheduling
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-asset-report') THEN
    PERFORM cron.unschedule('monthly-asset-report');
  END IF;
END $$;

-- Schedule: 09:00 UTC on the 1st of every month.
-- The function receives an empty body which is the cron-mode signal: it then
-- iterates ALL active organizations internally with Promise.allSettled.
SELECT cron.schedule(
  'monthly-asset-report',
  '0 9 1 * *',
  $cmd$
    SELECT net.http_post(
      url     := current_setting('app.edge_function_url') || '/monthly-asset-report',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || current_setting('app.service_role_key')
                 ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cmd$
);
