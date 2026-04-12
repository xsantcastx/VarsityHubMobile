-- AlterEnum: Add FOLLOW_REQUEST to NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FOLLOW_REQUEST';

-- AlterTable: Add status column to Follows
ALTER TABLE "Follows" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'accepted';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Follows_following_id_status_idx" ON "Follows"("following_id", "status");
