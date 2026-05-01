-- ============================================================
-- Schema v12: Asset Recovery
-- Tracks asset incidents (lost, damaged, stolen, insurance, write-off)
-- and financial recovery of funds.
-- Run this AFTER schema_v11_asset_requests.sql in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS recoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL DEFAULT 'damaged' CHECK (incident_type IN ('lost', 'damaged', 'stolen', 'insurance_claim', 'write_off')),
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'recovered', 'partially_recovered', 'closed', 'written_off')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL DEFAULT '',
  resolution TEXT DEFAULT '',
  estimated_loss NUMERIC(12,2) NOT NULL DEFAULT 0,
  recovered_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  incident_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_date TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_recoveries_org ON recoveries(organization_id);
CREATE INDEX idx_recoveries_asset ON recoveries(asset_id);
CREATE INDEX idx_recoveries_status ON recoveries(status);
CREATE INDEX idx_recoveries_org_status ON recoveries(organization_id, status);

-- Enable RLS
ALTER TABLE recoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recoveries_all" ON recoveries
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- DONE
-- ============================================================
