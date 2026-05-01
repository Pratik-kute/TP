-- ============================================================
-- Schema v9: Partner Companies
-- CRM-grade partner relationship management for the platform.
-- Modeled after Salesforce PRM, Odoo, HubSpot, and GoHighLevel.
-- Run this AFTER schema_v8_platform_admin.sql in Supabase SQL Editor
-- ============================================================

-- ============ 1. CREATE PARTNER_COMPANIES TABLE ============

CREATE TABLE IF NOT EXISTS partner_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identity
  company_name TEXT NOT NULL,
  short_code TEXT NOT NULL DEFAULT '',           -- e.g. "ACME", "TCS" (used in internal references)
  logo_url TEXT DEFAULT '',
  website TEXT DEFAULT '',

  -- Contact
  contact_person TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  country TEXT DEFAULT '',

  -- Classification
  industry TEXT DEFAULT '',
  company_size TEXT DEFAULT 'small' CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  partner_type TEXT DEFAULT 'reseller' CHECK (partner_type IN ('reseller', 'referral', 'technology', 'consulting', 'strategic', 'affiliate')),

  -- Tier (Salesforce-style Gold/Silver/Bronze + Platinum for top)
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),

  -- Status lifecycle
  status TEXT DEFAULT 'prospective' CHECK (status IN ('prospective', 'onboarding', 'active', 'inactive', 'suspended', 'churned')),

  -- Financials
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,      -- % commission on referred revenue
  lifetime_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,     -- total revenue attributed to this partner
  current_mrr NUMERIC(10,2) NOT NULL DEFAULT 0,          -- monthly recurring revenue from their referrals
  deal_count INTEGER NOT NULL DEFAULT 0,                  -- total closed deals

  -- Relationship
  assigned_manager TEXT DEFAULT '',                        -- internal account manager name
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,  -- if partner is also an org user
  referred_orgs INTEGER NOT NULL DEFAULT 0,               -- count of orgs referred by this partner

  -- Agreement
  contract_start DATE,
  contract_end DATE,
  payment_terms TEXT DEFAULT 'net_30' CHECK (payment_terms IN ('net_15', 'net_30', 'net_45', 'net_60', 'upon_receipt')),

  -- Notes & tags
  tags TEXT[] DEFAULT '{}',
  internal_notes TEXT DEFAULT '',

  -- Timestamps
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_partner_companies_status ON partner_companies(status);
CREATE INDEX IF NOT EXISTS idx_partner_companies_tier ON partner_companies(tier);
CREATE INDEX IF NOT EXISTS idx_partner_companies_type ON partner_companies(partner_type);

-- ============ 2. AUTO-UPDATE updated_at ============

CREATE OR REPLACE FUNCTION update_partner_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partner_companies_updated_at ON partner_companies;
CREATE TRIGGER trg_partner_companies_updated_at
  BEFORE UPDATE ON partner_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_companies_updated_at();

-- ============ 3. DONE ============
-- After running this migration:
-- - partner_companies table exists with full CRM fields
-- - Tiers: bronze, silver, gold, platinum
-- - Types: reseller, referral, technology, consulting, strategic, affiliate
-- - Statuses: prospective, onboarding, active, inactive, suspended, churned
-- - Commission tracking, MRR, deal counts, contract dates
-- - Auto-updates updated_at on every change
