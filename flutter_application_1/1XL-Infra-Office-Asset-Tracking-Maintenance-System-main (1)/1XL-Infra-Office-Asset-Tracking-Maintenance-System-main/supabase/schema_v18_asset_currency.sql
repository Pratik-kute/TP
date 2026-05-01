-- v18: Add per-asset currency field
ALTER TABLE assets ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
