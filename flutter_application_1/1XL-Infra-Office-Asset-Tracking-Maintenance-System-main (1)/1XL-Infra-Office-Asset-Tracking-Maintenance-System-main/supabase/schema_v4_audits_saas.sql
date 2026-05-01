-- ============================================================
-- Schema v4: SaaS Subscription Plans + Organization Subscriptions
-- Run this AFTER schema_v3.sql in Supabase SQL Editor
-- ============================================================

-- ============ SUBSCRIPTION PLANS ============

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  max_assets INTEGER NOT NULL DEFAULT 50,
  max_users INTEGER NOT NULL DEFAULT 5,
  max_locations INTEGER NOT NULL DEFAULT 1,
  qr_batch_limit INTEGER NOT NULL DEFAULT 10,
  has_audit_page BOOLEAN NOT NULL DEFAULT false,
  has_advanced_filters BOOLEAN NOT NULL DEFAULT false,
  has_column_customization BOOLEAN NOT NULL DEFAULT false,
  has_bulk_qr_export BOOLEAN NOT NULL DEFAULT false,
  has_depreciation BOOLEAN NOT NULL DEFAULT false,
  has_reports BOOLEAN NOT NULL DEFAULT false,
  has_documents BOOLEAN NOT NULL DEFAULT false,
  has_procurement BOOLEAN NOT NULL DEFAULT false,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ ORGANIZATION SUBSCRIPTIONS ============

CREATE TABLE organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','cancelled','expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ ROW LEVEL SECURITY ============

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON subscription_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON organization_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- ============ INDEXES ============

CREATE INDEX idx_org_subscriptions_org ON organization_subscriptions(organization_id);
CREATE INDEX idx_org_subscriptions_plan ON organization_subscriptions(plan_id);

-- ============ SEED SUBSCRIPTION PLANS ============

INSERT INTO subscription_plans (name, display_name, max_assets, max_users, max_locations, qr_batch_limit, has_audit_page, has_advanced_filters, has_column_customization, has_bulk_qr_export, has_depreciation, has_reports, has_documents, has_procurement, price_monthly, price_yearly)
VALUES
  ('beginner', 'Beginner', 50, 5, 1, 10, false, false, false, false, false, false, false, false, 0, 0),
  ('pro', 'Pro', 500, 25, 5, 50, true, true, true, false, true, true, true, false, 29.99, 299.99),
  ('premium', 'Premium', -1, -1, -1, -1, true, true, true, true, true, true, true, true, 79.99, 799.99);
