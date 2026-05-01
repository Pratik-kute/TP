-- ============================================================
-- v25: Subscription Expiry Reminder Log
-- ============================================================
-- Tracks which organizations have received a subscription
-- expiry reminder on a given calendar date, preventing the
-- daily Edge Function from sending duplicate emails.
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_reminder_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sent_date       DATE        NOT NULL,
  days_remaining  INTEGER     NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One reminder per org per calendar day
  UNIQUE (organization_id, sent_date)
);

ALTER TABLE subscription_reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON subscription_reminder_logs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_sub_reminder_logs_org  ON subscription_reminder_logs(organization_id);
CREATE INDEX idx_sub_reminder_logs_date ON subscription_reminder_logs(sent_date);

-- ============================================================
-- pg_cron: Schedule the reminder function daily at 09:00 UTC
--
-- Run this SQL once in your Supabase project's SQL Editor
-- (requires pg_cron extension to be enabled):
--
--   SELECT cron.schedule(
--     'subscription-expiry-reminder',   -- job name
--     '0 9 * * *',                       -- every day at 09:00 UTC
--     $$
--       SELECT net.http_post(
--         url     := '<YOUR_SUPABASE_FUNCTION_URL>/subscription-expiry-reminder',
--         headers := jsonb_build_object(
--           'Content-Type',  'application/json',
--           'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
--         ),
--         body    := '{}'::jsonb
--       );
--     $$
--   );
--
-- Replace:
--   <YOUR_SUPABASE_FUNCTION_URL>  →  e.g. https://xxxx.supabase.co/functions/v1
--   <YOUR_SERVICE_ROLE_KEY>       →  from Supabase project settings > API
-- ============================================================
