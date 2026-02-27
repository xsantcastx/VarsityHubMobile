-- Ensure Organization.updated_at always has a server-side value on insert.
-- This prevents NOT NULL violations if any code path omits updated_at.
ALTER TABLE "Organization"
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
