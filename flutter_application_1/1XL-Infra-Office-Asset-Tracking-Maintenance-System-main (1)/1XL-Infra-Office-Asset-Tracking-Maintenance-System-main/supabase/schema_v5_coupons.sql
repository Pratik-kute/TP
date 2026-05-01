-- ============================================================
-- Schema v5: Coupon / Promo Code System + Invite Links
-- Run this AFTER schema_v4_audits_saas.sql in Supabase SQL Editor
-- ============================================================

-- ============ COUPONS ============

CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'percentage' CHECK (type IN ('percentage', 'fixed_amount', 'trial_extension')),
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  applicable_plan_ids UUID[] DEFAULT '{}',  -- empty array = applies to all plans
  max_redemptions INTEGER NOT NULL DEFAULT 0,  -- 0 = unlimited
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,  -- null = never expires
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'depleted', 'disabled')),
  created_by UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ COUPON REDEMPTIONS (tracks who used what) ============

CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  plan_id_at_redemption UUID REFERENCES subscription_plans(id),
  discount_applied NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ============ ROW LEVEL SECURITY ============

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON coupons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON coupon_redemptions FOR ALL USING (true) WITH CHECK (true);

-- ============ INDEXES ============

CREATE UNIQUE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_org ON coupons(organization_id);
CREATE INDEX idx_coupons_status ON coupons(status);
CREATE INDEX idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);
CREATE INDEX idx_coupon_redemptions_user ON coupon_redemptions(user_id);
CREATE INDEX idx_coupon_redemptions_org ON coupon_redemptions(organization_id);

-- ============ AUTO-UPDATE updated_at ON COUPONS ============

CREATE OR REPLACE FUNCTION update_coupon_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coupon_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_coupon_updated_at();

-- ============ AUTO-INCREMENT current_redemptions ON REDEMPTION INSERT ============

CREATE OR REPLACE FUNCTION increment_coupon_redemptions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE coupons
    SET current_redemptions = current_redemptions + 1
  WHERE id = NEW.coupon_id;

  -- Auto-deplete if max_redemptions reached (and max > 0)
  UPDATE coupons
    SET status = 'depleted'
  WHERE id = NEW.coupon_id
    AND max_redemptions > 0
    AND current_redemptions >= max_redemptions;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_coupon_redemptions
  AFTER INSERT ON coupon_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION increment_coupon_redemptions();

-- ============ INVITE LINKS ============

CREATE TABLE invite_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  target_email TEXT,  -- null = anyone can use
  coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES subscription_plans(id),
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,  -- null = never expires
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used', 'disabled')),
  created_by UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON invite_links FOR ALL USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX idx_invite_links_token ON invite_links(token);
CREATE INDEX idx_invite_links_org ON invite_links(organization_id);
CREATE INDEX idx_invite_links_status ON invite_links(status);

-- Auto-mark invite as 'used' when max_uses reached
CREATE OR REPLACE FUNCTION check_invite_link_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_uses >= NEW.max_uses AND NEW.max_uses > 0 THEN
    NEW.status = 'used';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_invite_usage
  BEFORE UPDATE ON invite_links
  FOR EACH ROW
  EXECUTE FUNCTION check_invite_link_usage();
