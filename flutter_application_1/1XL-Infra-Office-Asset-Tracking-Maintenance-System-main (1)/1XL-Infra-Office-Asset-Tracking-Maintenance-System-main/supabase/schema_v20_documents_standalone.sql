-- v20: Make documents standalone (asset link optional), add file_name column
ALTER TABLE documents ALTER COLUMN asset_id DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN asset_id SET DEFAULT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT '';
