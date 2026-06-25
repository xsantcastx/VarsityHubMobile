/**
 * useRequireTeamManagement - Membership-aware team-management route guard
 *
 * Superset of useRequireCoach. Coaches keep their EXACT existing behavior (the
 * agreement/approval/billing/fan-mode redirects are unchanged). On top of that
 * it adds a membership escape hatch: a NON-coach user (role=fan) who actually
 * manages something — a team-staff membership (owner/manager/coach/
 * assistant_coach) surfaced by Team.managed(), or an owner/manager org
 * membership surfaced by Organization.reviewSummaries() — is allowed in. This
 * mirrors the server's membership-based canManageTeam rule, which is the real
 * gate (every mutation is 403-protected server-side regardless of this hook).
 *
 * Returns { canManage, loading } so screens can gate rendering exactly like
 * they did with useRequireCoach's { canAccessCoachTools, loading }.
 */

import { Organization, Team } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import {
  getCoachAccessState,
  getCoachGuardRedirect,
  resolveTeamManagementAccess,
  type CoachUserLike,
} from '@/utils/roleChecks';
import { captureException } from '@/utils/sentry';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';

function countItems(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  const items = (value as { items?: unknown })?.items;
  return Array.isArray(items) ? items.length : 0;
}

// A failed membership probe falls back to 0 (fail-closed: the user is bounced
// rather than wrongly admitted). Surface it so a manager wrongly bounced by a
// transient error is diagnosable instead of silently swallowed.
function reportProbeFailure(source: string, error: unknown) {
  captureException(
    error instanceof Error ? error : new Error(String((error as any)?.message || error)),
    {
      tags: { context: 'team_management_guard_probe', source },
    }
  );
}

export function useRequireTeamManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const coachUser = user as CoachUserLike | null | undefined;

  const coachAccess = useMemo(() => getCoachAccessState(coachUser), [coachUser]);
  const coachRedirect = useMemo(() => getCoachGuardRedirect(coachUser), [coachUser]);

  // The coach guard fully decides every coach (and the no-user case). The
  // membership probe is only needed for an AUTHENTICATED non-coach user the
  // coach guard would otherwise bounce — those are the users this hook newly
  // admits. An unauthenticated user (no `user`) is still bounced by the redirect
  // effect below; probing for them just fires two guaranteed-401 calls + Sentry
  // noise, so skip it.
  const needsMembershipProbe = !!user && !coachAccess.isCoach && coachRedirect !== null;

  const [probe, setProbe] = useState<{
    done: boolean;
    managedTeamCount: number;
    orgAdminCount: number;
  }>({ done: false, managedTeamCount: 0, orgAdminCount: 0 });

  const probeStartedRef = useRef(false);

  useEffect(() => {
    if (loading || !needsMembershipProbe || probeStartedRef.current) return undefined;
    probeStartedRef.current = true;
    let cancelled = false;
    void (async () => {
      const [teams, orgs] = await Promise.all([
        Team.managed().catch(e => {
          reportProbeFailure('managed_teams', e);
          return [];
        }),
        Organization.reviewSummaries().catch(e => {
          reportProbeFailure('org_admin', e);
          return [];
        }),
      ]);
      if (cancelled) return;
      setProbe({
        done: true,
        managedTeamCount: countItems(teams),
        orgAdminCount: countItems(orgs),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, needsMembershipProbe]);

  // Probing only blocks/decides for the non-coach path. Coaches resolve
  // immediately with no fetch.
  const probing = needsMembershipProbe && !probe.done;

  const decision = useMemo(
    () =>
      resolveTeamManagementAccess({
        user: coachUser,
        managedTeamCount: probe.managedTeamCount,
        orgAdminCount: probe.orgAdminCount,
      }),
    [coachUser, probe.managedTeamCount, probe.orgAdminCount]
  );

  useEffect(() => {
    if (loading || probing) return;
    if (!decision.allow && decision.redirectTo) {
      router.replace(decision.redirectTo as never);
    }
  }, [loading, probing, decision, router]);

  return { canManage: decision.allow, loading: loading || probing };
}
