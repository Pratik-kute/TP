-- v23: Add country field to organizations for location-based currency defaults
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;
