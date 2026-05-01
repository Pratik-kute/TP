-- Schema v14: Add work_mode to allocations table
-- Run this in the Supabase SQL Editor.
-- Pattern matches schema_v6 and schema_v13.

ALTER TABLE allocations ADD COLUMN IF NOT EXISTS work_mode TEXT DEFAULT NULL;

ALTER TABLE allocations DROP CONSTRAINT IF EXISTS allocations_work_mode_check;

ALTER TABLE allocations ADD CONSTRAINT allocations_work_mode_check
  CHECK (work_mode IS NULL OR work_mode IN ('wfo', 'wfh'));

CREATE INDEX IF NOT EXISTS idx_allocations_work_mode ON allocations(work_mode);
