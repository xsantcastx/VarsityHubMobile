-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'AD_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'JOIN_REQUEST_APPROVED';

-- CreateIndex (missing from prior migrations)
CREATE INDEX IF NOT EXISTS "Notification_post_id_idx" ON "Notification"("post_id");
CREATE INDEX IF NOT EXISTS "Notification_comment_id_idx" ON "Notification"("comment_id");
CREATE INDEX IF NOT EXISTS "Notification_message_id_idx" ON "Notification"("message_id");
