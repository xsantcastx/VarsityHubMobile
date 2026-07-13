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
import { replaceAsRedirect } from '@/utils/navigation';
import { getCoachAccessState, getCoachGuardRedirect, type CoachUserLike } from '@/utils/roleChecks';

export function useRequireCoach() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const coachUser = user as CoachUserLike | null | undefined;

  const coachAccess = useMemo(() => getCoachAccessState(coachUser), [coachUser]);
  const isCoach = coachAccess.isCoach;
  const isApprovedCoach = coachAccess.isApprovedCoach;
  const canAccessCoachTools = coachAccess.canAccessCoachTools && !coachAccess.needsPaidPlanCheckout;

  useEffect(() => {
    if (loading) return;

    // The full redirect decision (admin escape, fan mode, agreement/approval
    // recovery) lives in getCoachGuardRedirect so this guard and the
    // membership-aware useRequireTeamManagement guard can never drift.
    const redirect = getCoachGuardRedirect(coachUser);
    if (redirect) {
      // Guard bounce, not a visit — marked so the guarded screen never
      // becomes a back target that re-triggers this redirect.
      replaceAsRedirect(router, redirect as never);
    }
  }, [coachUser, loading, router]);

  return { isCoach, isApprovedCoach, canAccessCoachTools, loading };
}
