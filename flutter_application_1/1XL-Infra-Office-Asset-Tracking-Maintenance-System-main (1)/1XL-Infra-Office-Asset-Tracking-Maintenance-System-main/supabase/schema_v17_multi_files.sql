-- Schema v17: Multi-image and multi-invoice support per asset
-- Run this in the Supabase SQL Editor.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS invoice_urls TEXT[] DEFAULT '{}';
