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

  const canAccessCoachTools = useMemo(() => {
    if (!isApprovedCoach) return false;
    const prefs = (user as any)?.preferences || {};
    return !!prefs?.coach_agreement_accepted_at;
  }, [isApprovedCoach, user]);

  useEffect(() => {
    if (loading) return;
    if (!user || !isCoach) {
      router.replace('/(tabs)');
      return;
    }

    const prefs = (user as any)?.preferences || {};
    const approvalStatus = (user as any)?.approval_status;
    const needsAgreement = approvalStatus === 'APPROVED' && !prefs?.coach_agreement_accepted_at;
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
      router.replace('/onboarding/coach-agreement' as any);
    }
  }, [user, loading, isCoach, router]);

  return { isCoach, isApprovedCoach, canAccessCoachTools, loading };
}
