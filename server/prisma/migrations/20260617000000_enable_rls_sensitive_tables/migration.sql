-- Defense-in-depth: Row-Level Security on the most sensitive tables.
--
-- SAFE TO AUTO-DEPLOY: RLS is ENABLED but NOT FORCED. The application connects
-- as the table owner, and Postgres table owners BYPASS non-forced RLS — so the
-- live app's queries are completely unaffected by this migration (zero behavior
-- change). The policies below only constrain NON-owner roles: an analytics
-- read-replica role, a future least-privilege application role, or a leaked
-- lower-privilege credential. A single missed `requireAuth`/ownership check in
-- app code becomes non-exploitable for any connection that isn't the owner.
--
-- Policies key on a per-transaction session variable `app.current_user_id`.
-- current_setting(..., true) returns NULL (missing_ok) when it isn't set, so a
-- non-owner role with no user context sees no rows — fail closed.
--
-- TO ACTIVATE ENFORCEMENT FOR THE APP ITSELF (deliberate, later step — do NOT
-- do this implicitly):
--   1. Create a non-owner role and GRANT it the needed table privileges.
--   2. Point DATABASE_URL at that role.
--   3. Add Prisma middleware that runs `SET LOCAL app.current_user_id = $userId`
--      at the start of each authenticated transaction.
--   4. Optionally add `ALTER TABLE ... FORCE ROW LEVEL SECURITY` once the above
--      is verified in staging.
-- Until then these policies are dormant for the app and active only as a guard
-- against any other connection.

-- ── Message: a row is visible to its sender or recipient ──────────────────────
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS message_participant_access ON "Message";
CREATE POLICY message_participant_access ON "Message"
  FOR ALL
  USING (
    "sender_id" = current_setting('app.current_user_id', true)
    OR "recipient_id" = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    "sender_id" = current_setting('app.current_user_id', true)
  );

-- ── TeamMembership: a row is visible to the member it belongs to ──────────────
ALTER TABLE "TeamMembership" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_membership_owner_access ON "TeamMembership";
CREATE POLICY team_membership_owner_access ON "TeamMembership"
  FOR ALL
  USING ("user_id" = current_setting('app.current_user_id', true))
  WITH CHECK ("user_id" = current_setting('app.current_user_id', true));

-- ── OrganizationMembership: a row is visible to the member it belongs to ──────
ALTER TABLE "OrganizationMembership" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_membership_owner_access ON "OrganizationMembership";
CREATE POLICY org_membership_owner_access ON "OrganizationMembership"
  FOR ALL
  USING ("user_id" = current_setting('app.current_user_id', true))
  WITH CHECK ("user_id" = current_setting('app.current_user_id', true));

-- ── GroupChatMember: a row is visible to the member it belongs to ─────────────
ALTER TABLE "GroupChatMember" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS group_chat_member_owner_access ON "GroupChatMember";
CREATE POLICY group_chat_member_owner_access ON "GroupChatMember"
  FOR ALL
  USING ("user_id" = current_setting('app.current_user_id', true))
  WITH CHECK ("user_id" = current_setting('app.current_user_id', true));
