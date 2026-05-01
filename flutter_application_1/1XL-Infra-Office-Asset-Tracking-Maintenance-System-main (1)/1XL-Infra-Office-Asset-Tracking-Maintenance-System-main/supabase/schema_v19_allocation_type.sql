-- v19: Add allocation type and replacement tracking to allocations
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS allocation_type TEXT;
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS replaces_allocation_id UUID REFERENCES allocations(id) ON DELETE SET NULL;
