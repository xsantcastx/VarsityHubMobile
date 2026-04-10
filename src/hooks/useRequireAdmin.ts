/**
 * useRequireAdmin - Client-side admin route guard
 *
 * Prevents unauthorized users from accessing admin screens
 * Redirects to home if not admin
 */

import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export function useRequireAdmin() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to load
    if (loading) return;

    // If not logged in or not admin, redirect
    if (!user || !isAdmin) {
      router.replace('/(tabs)');
    }
  }, [user, loading, isAdmin, router]);

  return { isAdmin, loading };
}
