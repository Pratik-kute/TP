-- v22: Add per-organization currency support
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
