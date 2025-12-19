-- Migration: Drop deprecated EventPostAccess table and cleanup grace-period logic
-- Description: Remove the EventPostAccess table and related indexes after confirming
--              grace-period logic has been fully replaced by post-event participation rule.
--
-- Status: READY FOR REVIEW - Do not run without manual verification
-- 
-- Verification Checklist:
-- [ ] Confirm geofencing.ts no longer references EventPostAccess
-- [ ] Confirm no API endpoints query/insert EventPostAccess  
-- [ ] Confirm no frontend code references EventPostAccess
-- [ ] Confirm post-event rule (post-during-event check) is working in production
-- [ ] Backup database before running
-- [ ] Test in staging environment first
-- [ ] Schedule deployment during low-traffic window

-- ============================================================================

-- Step 1: Create indexes for better query performance (before deletion)
-- These will help with orphaned record cleanup if needed
CREATE INDEX IF NOT EXISTS idx_post_event_id_created_at 
  ON "Post"(event_id, created_at);

CREATE INDEX IF NOT EXISTS idx_story_event_id_created_at 
  ON "Story"(event_id, created_at);

-- ============================================================================

-- Step 2: Verify EventPostAccess table contents
-- RUN THIS FIRST to understand what data exists:
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT event_id) as unique_events,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM "EventPostAccess";

-- ============================================================================

-- Step 3: Archive EventPostAccess data (optional, for audit trail)
-- Uncomment to enable archival before deletion
-- 
-- CREATE TABLE "EventPostAccess_Archive" AS
-- SELECT * FROM "EventPostAccess";
-- 
-- CREATE INDEX idx_archive_event_user ON "EventPostAccess_Archive"(event_id, user_id);

-- ============================================================================

-- Step 4: Drop foreign key constraints referencing EventPostAccess
-- (There should be none, but check just in case)
-- Adapt table/constraint names if needed
ALTER TABLE IF EXISTS "EventPostAccess"
  DROP CONSTRAINT IF EXISTS "EventPostAccess_event_id_fkey",
  DROP CONSTRAINT IF EXISTS "EventPostAccess_user_id_fkey";

-- ============================================================================

-- Step 5: Drop the EventPostAccess table
DROP TABLE IF EXISTS "EventPostAccess" CASCADE;

-- ============================================================================

-- Step 6: Verify cleanup
-- Should return 0 results if table is gone
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'EventPostAccess'
) as "EventPostAccess_Still_Exists";

-- ============================================================================

-- Migration Rollback (if needed):
-- Restore from "EventPostAccess_Archive" or database backup
-- This is a destructive migration with no automatic rollback.

-- ============================================================================

-- Post-Migration Validation:
-- 1. Verify no application errors in logs related to missing table
-- 2. Confirm post creation still works after event ends (using post-during-event rule)
-- 3. Check performance metrics for post/story creation endpoints
-- 4. Monitor error rates for 24 hours after deployment
