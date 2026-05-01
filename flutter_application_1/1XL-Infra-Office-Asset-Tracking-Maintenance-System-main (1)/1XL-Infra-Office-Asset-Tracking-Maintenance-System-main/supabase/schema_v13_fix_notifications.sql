-- Fix notifications table: expand type CHECK constraint to include all event types
-- The original constraint only allowed: maintenance, repair, allocation, warranty, stock, procurement, system
-- The app also sends: user, asset, asset_request, recovery

-- Drop the old CHECK constraint and add the updated one
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('maintenance','repair','allocation','warranty','stock','procurement','system','user','asset','asset_request','recovery'));

-- Also add user_id foreign key if missing (some schemas didn't have it)
-- ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
