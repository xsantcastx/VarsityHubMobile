-- Hot-path composite indexes.
-- All four support queries that currently scan + filter in memory or sort
-- without index support. Using CONCURRENTLY is not possible inside the
-- transaction Prisma wraps each migration in; these tables are small enough
-- that a brief lock is acceptable during deploy.

-- Notification unread feed ordered by date
CREATE INDEX IF NOT EXISTS "Notification_user_id_read_at_created_at_idx"
    ON "Notification" ("user_id", "read_at", "created_at");

-- Admin pending-events queue ordered by date
CREATE INDEX IF NOT EXISTS "Event_approval_status_date_idx"
    ON "Event" ("approval_status", "date");

-- Message thread list (unread + recent first)
CREATE INDEX IF NOT EXISTS "Message_recipient_id_read_created_at_idx"
    ON "Message" ("recipient_id", "read", "created_at");

-- Organization duplicate-check is already zip-scoped in code; this index
-- supports status='active' filter applied in findDuplicateOrganization().
CREATE INDEX IF NOT EXISTS "Organization_zip_code_status_idx"
    ON "Organization" ("zip_code", "status");
