-- ============================================================
-- Schema v8: Platform Admin Isolation
-- Makes coupons & invite_links platform-wide (not org-scoped)
-- Adds metadata to organizations for better admin visibility
-- Run this AFTER schema_v7_custom_fields.sql in Supabase SQL Editor
-- ============================================================

-- ============ 1. MAKE COUPONS PLATFORM-WIDE ============
-- Coupons are managed by the platform super admin, not by individual orgs.
-- Drop the NOT NULL constraint on organization_id so platform-level coupons have NULL org.

ALTER TABLE coupons ALTER COLUMN organization_id DROP NOT NULL;

-- Set existing coupons to NULL org (they become platform-wide)
UPDATE coupons SET organization_id = NULL;

-- Drop the old FK-based ON DELETE CASCADE index and re-create without NOT NULL assumption
DROP INDEX IF EXISTS idx_coupons_org;
CREATE INDEX idx_coupons_org ON coupons(organization_id) WHERE organization_id IS NOT NULL;

-- ============ 2. MAKE INVITE LINKS PLATFORM-WIDE ============
-- Invite links are also managed at platform level by super admin.

ALTER TABLE invite_links ALTER COLUMN organization_id DROP NOT NULL;

-- Set existing invite links to NULL org (platform-wide)
UPDATE invite_links SET organization_id = NULL;

DROP INDEX IF EXISTS idx_invite_links_org;
CREATE INDEX idx_invite_links_org ON invite_links(organization_id) WHERE organization_id IS NOT NULL;

-- ============ 3. MAKE COUPON REDEMPTIONS ORG-OPTIONAL ============
-- Redemptions track which org redeemed, but the coupon itself is platform-wide.

ALTER TABLE coupon_redemptions ALTER COLUMN organization_id DROP NOT NULL;

-- ============ 4. ADD ORGANIZATION METADATA FOR ADMIN DASHBOARD ============
-- These columns help the super admin see org health at a glance.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ============ 5. ADD BILLING FIELDS TO ORGANIZATION_SUBSCRIPTIONS ============
-- Better subscription tracking for the admin dashboard.

ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly'));
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- ============ 6. ADD DISCOUNT FIELDS TO SUBSCRIPTION PLANS ============
-- Allow super admin to configure per-plan discounts.

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS discount_note TEXT DEFAULT '';

-- ============ 7. DONE ============
-- After running this migration:
-- - Coupons and invite links are now platform-wide (organization_id is nullable)
-- - Organizations have additional metadata columns
-- - Subscriptions have billing cycle and renewal tracking
