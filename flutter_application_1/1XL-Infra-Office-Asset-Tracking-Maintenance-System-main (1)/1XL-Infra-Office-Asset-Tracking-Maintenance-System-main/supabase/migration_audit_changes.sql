-- Add structured changes tracking to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes JSONB DEFAULT '[]'::jsonb;
