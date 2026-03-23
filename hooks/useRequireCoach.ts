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

  useEffect(() => {
    if (loading) return;
    if (!user || !isCoach) {
      router.replace('/(tabs)');
    }
  }, [user, loading, isCoach, router]);

  return { isCoach, isApprovedCoach, loading };
}
