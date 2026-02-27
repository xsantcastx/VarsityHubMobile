-- Add new notification types: MENTION, COMMENT_REPLY, SHARE
ALTER TYPE "NotificationType" ADD VALUE 'MENTION';
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_REPLY';
ALTER TYPE "NotificationType" ADD VALUE 'SHARE';

-- Add parent_id to Comment for reply-to-comment support
ALTER TABLE "Comment" ADD COLUMN "parent_id" TEXT REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for finding replies to a comment
CREATE INDEX IF NOT EXISTS "Comment_parent_id_idx" ON "Comment"("parent_id");
