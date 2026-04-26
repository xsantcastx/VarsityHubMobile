/**
 * One-shot org/team/coach wipe.
 *
 * Mirrors server/scripts/wipe-org-state.sql but runs in-process during
 * server startup, gated by an exact-match safety env var. This exists
 * because executing the SQL via railway ssh requires MEMBER-role auth
 * that isn't available from a service-scoped CLI token.
 *
 * SAFETY:
 *   - Only runs if process.env.ONESHOT_WIPE_ORG_STATE === SAFETY_STRING
 *   - Single Prisma transaction — failure rolls everything back
 *   - Server startup continues regardless of wipe outcome
 *
 * AFTER A SUCCESSFUL RUN:
 *   - Unset ONESHOT_WIPE_ORG_STATE in Railway so a future restart
 *     does not re-run the wipe
 *   - Revert this file + the call site in index.ts so the code is
 *     gone from the repo
 */

import { prisma } from './prisma.js';
import { captureException, captureMessage } from './sentry.js';

const SAFETY_STRING = 'YES_DELETE_ALL_NON_ADMIN_ORGS_AND_TEAMS_AND_DOWNGRADE_COACHES';
const ENV_KEY = 'ONESHOT_WIPE_ORG_STATE';

const PROTECTED_EMAILS = ['emancero@varsityhub.app', 'customerservice@varsityhub.app'];

type Counts = {
  teams: number;
  team_memberships: number;
  team_invites: number;
  team_follows: number;
  orgs: number;
  org_memberships: number;
  org_join_requests: number;
  coach_apps: number;
  coach_users: number;
  events_attached_to_team: number;
};

async function collectCounts(): Promise<Counts> {
  const [
    teams,
    team_memberships,
    team_invites,
    team_follows,
    orgs,
    org_memberships,
    org_join_requests,
    coach_apps,
    coach_users,
    events_attached_to_team,
  ] = await Promise.all([
    prisma.team.count(),
    prisma.teamMembership.count(),
    prisma.teamInvite.count(),
    prisma.teamFollow.count(),
    prisma.organization.count(),
    prisma.organizationMembership.count(),
    prisma.organizationJoinRequest.count(),
    prisma.coachApplication.count(),
    prisma.user.count({ where: { role: 'coach' } }),
    prisma.event.count({ where: { team_id: { not: null } } }),
  ]);
  return {
    teams,
    team_memberships,
    team_invites,
    team_follows,
    orgs,
    org_memberships,
    org_join_requests,
    coach_apps,
    coach_users,
    events_attached_to_team,
  };
}

export async function runOneshotWipeIfRequested(): Promise<void> {
  const requested = process.env[ENV_KEY];
  if (!requested) return;
  if (requested !== SAFETY_STRING) {
    console.warn(
      `[oneshot-wipe] ${ENV_KEY} is set but does not match safety string. Refusing to run.`
    );
    return;
  }

  console.warn(`[oneshot-wipe] STARTING destructive org/team/coach wipe`);
  captureMessage('[oneshot-wipe] starting', 'warning', { context: 'oneshot_wipe_start' });

  try {
    const pre = await collectCounts();
    console.warn('[oneshot-wipe] PRE counts:', JSON.stringify(pre));

    await prisma.$transaction(
      async tx => {
        // Snapshot ids first so the post-deletion notification cleanup can
        // target only notifications that were referencing these entities.
        const teamIds = (await tx.$queryRawUnsafe<{ id: string }[]>(
          'SELECT id FROM "Team"'
        )).map(r => r.id);
        const orgIds = (await tx.$queryRawUnsafe<{ id: string }[]>(
          'SELECT id FROM "Organization"'
        )).map(r => r.id);

        // Step 1: orphan events from teams (preserve RSVP/notif history)
        await tx.$executeRawUnsafe(
          'UPDATE "Event" SET team_id = NULL WHERE team_id IS NOT NULL'
        );

        // Step 2: wipe team-side
        await tx.$executeRawUnsafe('DELETE FROM "TeamInvite"');
        await tx.$executeRawUnsafe('DELETE FROM "TeamFollow"');
        await tx.$executeRawUnsafe('DELETE FROM "TeamMembership"');
        await tx.$executeRawUnsafe('DELETE FROM "Team"');

        // Step 3: wipe org-side
        await tx.$executeRawUnsafe('DELETE FROM "OrganizationJoinRequest"');
        await tx.$executeRawUnsafe('DELETE FROM "OrganizationMembership"');
        await tx.$executeRawUnsafe('DELETE FROM "Organization"');

        // Step 4: wipe stale notifications referencing wiped teams/orgs
        if (teamIds.length > 0 || orgIds.length > 0) {
          const conditions: string[] = [];
          const params: string[] = [];
          let paramIdx = 1;
          if (teamIds.length > 0) {
            const placeholders = teamIds.map(() => `$${paramIdx++}`).join(',');
            conditions.push(`meta->>'team_id' IN (${placeholders})`);
            params.push(...teamIds);
          }
          if (orgIds.length > 0) {
            const placeholders = orgIds.map(() => `$${paramIdx++}`).join(',');
            conditions.push(`meta->>'organization_id' IN (${placeholders})`);
            params.push(...orgIds);
          }
          await tx.$executeRawUnsafe(
            `DELETE FROM "Notification" WHERE ${conditions.join(' OR ')}`,
            ...params
          );
        }

        // Step 5: wipe coach applications (clean slate for re-apply)
        await tx.$executeRawUnsafe('DELETE FROM "CoachApplication"');

        // Step 6: downgrade coach-role users to fan (preserves account/posts/auth)
        await tx.$executeRawUnsafe(
          `UPDATE "User"
             SET role = 'fan',
                 approval_status = NULL,
                 rejected_at = NULL,
                 rejection_reason = NULL,
                 proceeding_as_fan = false,
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
                 ) || jsonb_build_object('role', 'fan', 'onboarding_completed', false)
           WHERE role = 'coach'
             AND lower(email) NOT IN ($1, $2)`,
          ...PROTECTED_EMAILS
        );
      },
      { timeout: 120_000 }
    );

    const post = await collectCounts();
    console.warn('[oneshot-wipe] POST counts:', JSON.stringify(post));
    console.warn(
      `[oneshot-wipe] COMPLETED. Unset ${ENV_KEY} in Railway and revert the startup hook.`
    );
    captureMessage('[oneshot-wipe] completed', 'warning', {
      context: 'oneshot_wipe_complete',
      pre: JSON.stringify(pre),
      post: JSON.stringify(post),
    });
  } catch (err) {
    console.error('[oneshot-wipe] FAILED — rolled back. Server continues normal startup.', err);
    captureException(err instanceof Error ? err : new Error(String(err)), {
      context: 'oneshot_wipe_failed',
    });
  }
}
