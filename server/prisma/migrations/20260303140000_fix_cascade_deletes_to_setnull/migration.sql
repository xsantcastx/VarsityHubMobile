-- Fix cascade deletes that destroy other users' data when one user is deleted.
-- Change GroupChat.created_by, Message.recipient_id, Notification.actor_id,
-- Ad.user_id, PromoRedemption.user_id, and AbuseReport.reporter_id
-- from ON DELETE CASCADE to ON DELETE SET NULL.

-- GroupChat.created_by: deleting creator was destroying entire group chat
ALTER TABLE "GroupChat" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "GroupChat" DROP CONSTRAINT "GroupChat_created_by_fkey";
ALTER TABLE "GroupChat" ADD CONSTRAINT "GroupChat_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Message.recipient_id: deleting recipient was removing messages from sender's mailbox
ALTER TABLE "Message" ALTER COLUMN "recipient_id" DROP NOT NULL;
ALTER TABLE "Message" DROP CONSTRAINT "Message_recipient_id_fkey";
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notification.actor_id: deleting actor was removing notifications from other users' feeds
ALTER TABLE "Notification" ALTER COLUMN "actor_id" DROP NOT NULL;
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_actor_id_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ad.user_id: deleting user was destroying their ad records (already nullable)
ALTER TABLE "Ad" DROP CONSTRAINT "Ad_user_id_fkey";
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PromoRedemption.user_id: deleting user was destroying redemption audit trail
ALTER TABLE "PromoRedemption" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "PromoRedemption" DROP CONSTRAINT "PromoRedemption_user_id_fkey";
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AbuseReport.reporter_id: deleting user was destroying abuse report evidence
ALTER TABLE "AbuseReport" ALTER COLUMN "reporter_id" DROP NOT NULL;
ALTER TABLE "AbuseReport" DROP CONSTRAINT "AbuseReport_reporter_id_fkey";
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_reporter_id_fkey"
  FOREIGN KEY ("reporter_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
