-- Add missing NotificationType enum values
-- These were in the Prisma schema but never migrated to the database
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AD_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AD_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORG_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOIN_REQUEST_APPROVED';

-- Add missing indexes from schema changes
CREATE INDEX IF NOT EXISTS "Event_creator_id_created_at_idx" ON "Event"("creator_id", "created_at");
CREATE INDEX IF NOT EXISTS "OrganizationMembership_user_id_idx" ON "OrganizationMembership"("user_id");
