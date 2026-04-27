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
import { getCoachAccessState, getPendingCoachRoute } from '@/utils/roleChecks';

export function useRequireCoach() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const coachAccess = useMemo(() => getCoachAccessState(user as any), [user]);
  const isCoach = coachAccess.isCoach;
  const isApprovedCoach = coachAccess.isApprovedCoach;
  const hasCurrentAgreement = coachAccess.hasCurrentCoachAgreement;
  const canAccessCoachTools = coachAccess.canAccessCoachTools;

  useEffect(() => {
    if (loading) return;

    // Admin escape: an admin who happens to have dirty coach state (test
    // residue, manual DB edit, etc.) must never be trapped in the
    // pending-approval recovery route. Mirror of the admin overrides in
    // utils/appRouteDecisions.ts and utils/roleChecks.ts:getCoachRecoveryRoute
    // shipped in commit 7c875eb6 — this hook is the third routing path
    // and was missed in that pass. Send them back to /(tabs) instead.
    if ((user as any)?.is_admin === true && (coachAccess.isPendingCoach || coachAccess.isRejectedCoach)) {
      router.replace('/(tabs)');
      return;
    }

    if (!user || !isCoach) {
      router.replace('/(tabs)');
      return;
    }

    const agreementOutdated =
      coachAccess.hasAcceptedCoachAgreement &&
      coachAccess.acceptedCoachAgreementVersion < coachAccess.requiredCoachAgreementVersion;
    const needsAgreement = coachAccess.isApprovedCoach && !coachAccess.hasCurrentCoachAgreement;
    const pendingRoute = getPendingCoachRoute(user as any);

    if (coachAccess.isPendingCoach || coachAccess.isRejectedCoach) {
      router.replace(pendingRoute as any);
      return;
    }

    if (needsAgreement) {
      router.replace({
        pathname: '/onboarding/coach-agreement',
        params: agreementOutdated ? { reason: 'outdated' } : undefined,
      } as any);
    }
  }, [coachAccess, hasCurrentAgreement, isCoach, loading, router, user]);

  return { isCoach, isApprovedCoach, canAccessCoachTools, loading };
}
