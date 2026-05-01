-- Schema v15: Add floor_no to locations and departments tables
-- Run this in the Supabase SQL Editor.

ALTER TABLE locations ADD COLUMN IF NOT EXISTS floor_no TEXT DEFAULT NULL;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS floor_no TEXT DEFAULT NULL;
