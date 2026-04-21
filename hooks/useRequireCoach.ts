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

export function useRequireCoach() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isCoach = useMemo(() => {
    if (!user) return false;
    const prefs = (user as any)?.preferences;
    return prefs?.role === 'coach';
  }, [user]);

  const isApprovedCoach = useMemo(() => {
    if (!isCoach) return false;
    return (user as any)?.approval_status === 'APPROVED';
  }, [isCoach, user]);

  const hasCurrentAgreement = useMemo(() => {
    if (!isApprovedCoach) return false;
    const prefs = (user as any)?.preferences || {};
    const acceptedAt = prefs?.coach_agreement_accepted_at;
    const acceptedVersion = Number(prefs?.coach_agreement_version ?? 1);
    const requiredVersion = Number((user as any)?.required_coach_agreement_version ?? 1);
    return !!acceptedAt && acceptedVersion >= requiredVersion;
  }, [isApprovedCoach, user]);

  const canAccessCoachTools = useMemo(() => {
    return isApprovedCoach && hasCurrentAgreement;
  }, [hasCurrentAgreement, isApprovedCoach]);

  useEffect(() => {
    if (loading) return;
    if (!user || !isCoach) {
      router.replace('/(tabs)');
      return;
    }

    const prefs = (user as any)?.preferences || {};
    const approvalStatus = (user as any)?.approval_status;
    const acceptedVersion = Number(prefs?.coach_agreement_version ?? 1);
    const requiredVersion = Number((user as any)?.required_coach_agreement_version ?? 1);
    const agreementOutdated =
      !!prefs?.coach_agreement_accepted_at && acceptedVersion < requiredVersion;
    const needsAgreement = approvalStatus === 'APPROVED' && !hasCurrentAgreement;
    const pendingRoute =
      prefs?.join_request_pending === true
        ? '/onboarding/pending-approval'
        : prefs?.organization_id
          ? '/onboarding/league-pending-approval'
          : '/onboarding/pending-approval';

    if (approvalStatus === 'PENDING' || approvalStatus === 'REJECTED') {
      router.replace(pendingRoute as any);
      return;
    }

    if (needsAgreement) {
      router.replace({
        pathname: '/onboarding/coach-agreement',
        params: agreementOutdated ? { reason: 'outdated' } : undefined,
      } as any);
    }
  }, [user, loading, isCoach, router, hasCurrentAgreement]);

  return { isCoach, isApprovedCoach, canAccessCoachTools, loading };
}
