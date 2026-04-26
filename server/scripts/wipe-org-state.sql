-- =============================================================
-- wipe-org-state.sql
--
-- Resets the org/team/coach slate so existing coach-role users
-- have to go through the application process again. Preserves
-- user accounts, posts, auth, and admin accounts.
--
-- WHAT THIS DOES (in order, single transaction):
--   1. Print pre-wipe counts (blast radius)
--   2. Snapshot team/org IDs targeted by the wipe
--   3. Orphan events: set team_id = NULL so RSVP/notification
--      history survives the team delete
--   4. Delete team-side rows (invites, follows, memberships, teams)
--   5. Delete org-side rows (join requests, memberships, organizations)
--   6. Delete stale notifications referencing deleted teams/orgs
--   7. Delete coach applications (clean slate for re-application)
--   8. Downgrade coach-role users to fan + clear coach-state
--      preferences. Excludes: emancero@varsityhub.app and
--      customerservice@varsityhub.app.
--   9. Print post-wipe counts
--
-- WHAT THIS DOES NOT DO:
--   - Touch user.posts, user.comments, user.likes (preserved)
--   - Wipe push tokens, sessions, refresh tokens
--   - Wipe billing/subscription rows (lookups by user_id stay)
--   - Touch admin accounts in ADMIN_EMAILS
--   - Touch notifications that do not reference wiped teams/orgs
--     via meta.team_id / meta.organization_id
--
-- HOW TO RUN:
--   railway ssh --service api
--   psql $DATABASE_URL -f scripts/wipe-org-state.sql
--
-- The whole script runs inside one transaction (BEGIN ... COMMIT).
-- If anything fails mid-way, the entire wipe rolls back. To inspect
-- pre/post counts without committing, comment out COMMIT and run
-- with ROLLBACK at the end.
-- =============================================================

BEGIN;

CREATE TEMP TABLE _wipe_target_teams AS
SELECT id
FROM "Team";

CREATE TEMP TABLE _wipe_target_orgs AS
SELECT id
FROM "Organization";

-- ── Pre-wipe counts ─────────────────────────────────────────
SELECT 'pre' AS phase,
  (SELECT count(*) FROM "Team")                            AS teams,
  (SELECT count(*) FROM "TeamMembership")                  AS team_memberships,
  (SELECT count(*) FROM "TeamInvite")                      AS team_invites,
  (SELECT count(*) FROM "TeamFollow")                      AS team_follows,
  (SELECT count(*) FROM "Organization")                    AS orgs,
  (SELECT count(*) FROM "OrganizationMembership")          AS org_memberships,
  (SELECT count(*) FROM "OrganizationJoinRequest")         AS org_join_requests,
  (SELECT count(*) FROM "CoachApplication")                AS coach_apps,
  (SELECT count(*) FROM "User" WHERE role = 'coach')       AS coach_users,
  (SELECT count(*) FROM "Event" WHERE team_id IS NOT NULL) AS events_attached_to_team,
  (
    SELECT count(*)
    FROM "Notification" n
    JOIN _wipe_target_teams t ON t.id = n.meta->>'team_id'
  )                                                        AS team_notifications,
  (
    SELECT count(*)
    FROM "Notification" n
    JOIN _wipe_target_orgs o ON o.id = n.meta->>'organization_id'
  )                                                        AS org_notifications;

-- ── Step 1: orphan events from teams (preserve RSVP/notif history)
UPDATE "Event"
SET team_id = NULL
WHERE team_id IS NOT NULL;

-- ── Step 2: wipe team-side rows
DELETE FROM "TeamInvite";
DELETE FROM "TeamFollow";
DELETE FROM "TeamMembership";
DELETE FROM "Team";

-- ── Step 3: wipe org-side rows
DELETE FROM "OrganizationJoinRequest";
DELETE FROM "OrganizationMembership";
DELETE FROM "Organization";

-- ── Step 4: wipe stale notifications that point at deleted teams/orgs
DELETE FROM "Notification"
WHERE meta->>'team_id' IN (SELECT id FROM _wipe_target_teams)
   OR meta->>'organization_id' IN (SELECT id FROM _wipe_target_orgs);

-- ── Step 5: wipe coach applications (clean slate for re-apply)
DELETE FROM "CoachApplication";

-- ── Step 6: downgrade coach-role users to fan
-- Clears column-level coach state and the equivalent fields nested
-- in preferences (which the canonical helpers also read).
UPDATE "User"
SET
  role               = 'fan',
  approval_status    = 'APPROVED',
  rejected_at        = NULL,
  rejection_reason   = NULL,
  proceeding_as_fan  = false,
  onboarding_completed = false,
  preferences = (
    COALESCE(preferences, '{}'::jsonb)
      - 'organization_id'
      - 'join_request_pending'
      - 'coach_agreement_accepted_at'
      - 'coach_agreement_version'
      - 'pending_plan'
      - 'payment_pending'
      - 'payment_approved'
      - 'proceeding_as_fan'
  ) || jsonb_build_object(
    'role', 'fan',
    'onboarding_completed', false
  )
WHERE role = 'coach'
  AND lower(email) NOT IN (
    'emancero@varsityhub.app',
    'customerservice@varsityhub.app'
  );

-- ── Post-wipe counts
SELECT 'post' AS phase,
  (SELECT count(*) FROM "Team")                            AS teams,
  (SELECT count(*) FROM "TeamMembership")                  AS team_memberships,
  (SELECT count(*) FROM "TeamInvite")                      AS team_invites,
  (SELECT count(*) FROM "TeamFollow")                      AS team_follows,
  (SELECT count(*) FROM "Organization")                    AS orgs,
  (SELECT count(*) FROM "OrganizationMembership")          AS org_memberships,
  (SELECT count(*) FROM "OrganizationJoinRequest")         AS org_join_requests,
  (SELECT count(*) FROM "CoachApplication")                AS coach_apps,
  (SELECT count(*) FROM "User" WHERE role = 'coach')       AS coach_users,
  (SELECT count(*) FROM "Event" WHERE team_id IS NOT NULL) AS events_attached_to_team,
  (
    SELECT count(*)
    FROM "Notification" n
    JOIN _wipe_target_teams t ON t.id = n.meta->>'team_id'
  )                                                        AS team_notifications,
  (
    SELECT count(*)
    FROM "Notification" n
    JOIN _wipe_target_orgs o ON o.id = n.meta->>'organization_id'
  )                                                        AS org_notifications;

COMMIT;
