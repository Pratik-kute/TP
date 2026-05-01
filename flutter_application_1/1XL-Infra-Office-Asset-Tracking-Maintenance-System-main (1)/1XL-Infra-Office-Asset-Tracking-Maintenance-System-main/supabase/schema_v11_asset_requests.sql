-- ============================================================
-- Schema v11: Asset Requests
-- Adds the asset_requests table for employees to request assets
-- and managers/admins to approve or reject them.
-- Run this AFTER schema_v10_page_access.sql in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS asset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'it_equipment',
  category TEXT DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled', 'cancelled')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_date TIMESTAMPTZ,
  review_note TEXT DEFAULT '',
  fulfilled_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_asset_requests_org ON asset_requests(organization_id);
CREATE INDEX idx_asset_requests_requester ON asset_requests(requester_id);
CREATE INDEX idx_asset_requests_status ON asset_requests(status);
CREATE INDEX idx_asset_requests_org_status ON asset_requests(organization_id, status);

-- Enable RLS
ALTER TABLE asset_requests ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write (app-level auth handles role checks)
CREATE POLICY "asset_requests_all" ON asset_requests
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- DONE
-- After running this migration:
-- - asset_requests table is created with proper FK constraints
-- - Indexes added for org, requester, and status queries
-- - RLS enabled with permissive policy (app handles authorization)
-- ============================================================
