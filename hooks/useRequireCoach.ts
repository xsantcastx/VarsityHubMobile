/**
 * useRequireCoach - Client-side coach route guard
 *
 * Prevents non-coach users from accessing coach-only screens.
 * Returns { isCoach, loading } so screens can gate rendering.
 * Redirects to home if not a coach.
 */

import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import {
  getCoachAccessState,
  getPendingCoachRoute,
  type CoachUserLike,
} from '@/utils/roleChecks';

export function useRequireCoach() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const coachUser = user as CoachUserLike | null | undefined;

  const coachAccess = useMemo(() => getCoachAccessState(coachUser), [coachUser]);
  const isCoach = coachAccess.isCoach;
  const isApprovedCoach = coachAccess.isApprovedCoach;
  const canAccessCoachTools = coachAccess.canAccessCoachTools;

  useEffect(() => {
    if (loading) return;

    // Admin escape: an admin who happens to have dirty coach state (test
    // residue, manual DB edit, etc.) must never be trapped in the
    // pending-approval recovery route. Mirror of the admin overrides in
    // utils/appRouteDecisions.ts and utils/roleChecks.ts:getCoachRecoveryRoute
    // shipped in commit 7c875eb6 — this hook is the third routing path
    // and was missed in that pass. Send them back to /(tabs) instead.
    if (coachUser?.is_admin === true && (coachAccess.isPendingCoach || coachAccess.isRejectedCoach)) {
      router.replace('/(tabs)');
      return;
    }

    if (!user || !isCoach) {
      router.replace('/(tabs)');
      return;
    }

    const pendingRoute = getPendingCoachRoute(coachUser);

    if (coachAccess.isPendingCoach || coachAccess.isRejectedCoach) {
      router.replace(pendingRoute as never);
    }
  }, [coachAccess, coachUser, isCoach, loading, router, user]);

  return { isCoach, isApprovedCoach, canAccessCoachTools, loading };
}
