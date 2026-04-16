-- Phase 3 hardening
-- 1. Enforce DB-level length constraints for user-facing short text fields that already
--    have application-level max validation.
-- 2. Rollback note: revert affected columns to TEXT if production data exceeds these limits
--    and the migration must be undone:
--      ALTER TABLE "User" ALTER COLUMN "display_name" TYPE TEXT;
--      ...repeat for any constrained column below.

ALTER TABLE "User"
  ALTER COLUMN "email" TYPE VARCHAR(320),
  ALTER COLUMN "display_name" TYPE VARCHAR(120),
  ALTER COLUMN "username" TYPE VARCHAR(20),
  ALTER COLUMN "avatar_url" TYPE VARCHAR(2048),
  ALTER COLUMN "bio" TYPE VARCHAR(300);

ALTER TABLE "Game"
  ALTER COLUMN "title" TYPE VARCHAR(200),
  ALTER COLUMN "watch_location" TYPE VARCHAR(200),
  ALTER COLUMN "destination" TYPE VARCHAR(200);

ALTER TABLE "Post"
  ALTER COLUMN "title" TYPE VARCHAR(200),
  ALTER COLUMN "content" TYPE VARCHAR(4000),
  ALTER COLUMN "type" TYPE VARCHAR(50);

ALTER TABLE "Event"
  ALTER COLUMN "title" TYPE VARCHAR(200),
  ALTER COLUMN "location" TYPE VARCHAR(500),
  ALTER COLUMN "creator_role" TYPE VARCHAR(50),
  ALTER COLUMN "event_type" TYPE VARCHAR(50),
  ALTER COLUMN "description" TYPE VARCHAR(5000),
  ALTER COLUMN "linked_league" TYPE VARCHAR(255),
  ALTER COLUMN "contact_info" TYPE VARCHAR(500);

ALTER TABLE "Message"
  ALTER COLUMN "content" TYPE VARCHAR(5000);

ALTER TABLE "GroupChat"
  ALTER COLUMN "name" TYPE VARCHAR(100);

ALTER TABLE "GroupChatMessage"
  ALTER COLUMN "content" TYPE VARCHAR(5000);

ALTER TABLE "Comment"
  ALTER COLUMN "content" TYPE VARCHAR(1000);

ALTER TABLE "Ad"
  ALTER COLUMN "contact_name" TYPE VARCHAR(200),
  ALTER COLUMN "contact_email" TYPE VARCHAR(320),
  ALTER COLUMN "business_name" TYPE VARCHAR(200),
  ALTER COLUMN "banner_url" TYPE VARCHAR(2048),
  ALTER COLUMN "target_url" TYPE VARCHAR(2048),
  ALTER COLUMN "target_zip_code" TYPE VARCHAR(12),
  ALTER COLUMN "description" TYPE VARCHAR(1000),
  ALTER COLUMN "admin_note" TYPE VARCHAR(2000);

ALTER TABLE "Story"
  ALTER COLUMN "caption" TYPE VARCHAR(500);

ALTER TABLE "Team"
  ALTER COLUMN "name" TYPE VARCHAR(100),
  ALTER COLUMN "description" TYPE VARCHAR(1000),
  ALTER COLUMN "sport" TYPE VARCHAR(100),
  ALTER COLUMN "extracurricular_category" TYPE VARCHAR(100),
  ALTER COLUMN "season" TYPE VARCHAR(50),
  ALTER COLUMN "primary_color" TYPE VARCHAR(20),
  ALTER COLUMN "venue_place_id" TYPE VARCHAR(255),
  ALTER COLUMN "venue_address" TYPE VARCHAR(500),
  ALTER COLUMN "city" TYPE VARCHAR(100),
  ALTER COLUMN "state" TYPE VARCHAR(100),
  ALTER COLUMN "league" TYPE VARCHAR(100);

ALTER TABLE "Organization"
  ALTER COLUMN "name" TYPE VARCHAR(255),
  ALTER COLUMN "description" TYPE VARCHAR(2000),
  ALTER COLUMN "logo_url" TYPE VARCHAR(2000),
  ALTER COLUMN "profile_picture_url" TYPE VARCHAR(2000),
  ALTER COLUMN "background_url" TYPE VARCHAR(2000),
  ALTER COLUMN "sport" TYPE VARCHAR(100),
  ALTER COLUMN "org_type" TYPE VARCHAR(100),
  ALTER COLUMN "location" TYPE VARCHAR(500),
  ALTER COLUMN "zip_code" TYPE VARCHAR(20),
  ALTER COLUMN "contact_info" TYPE VARCHAR(500),
  ALTER COLUMN "supporting_document_url" TYPE VARCHAR(2000);
