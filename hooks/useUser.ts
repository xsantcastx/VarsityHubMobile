import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { getAuthSnapshot } from '@/utils/authState';

/**
 * Custom hook to load and access current user data.
 *
 * @param autoLoad - Whether to automatically load user on mount (default: true)
 * @returns Object containing user data, loading state, error, and refresh function
 */
export function useUser(autoLoad: boolean = true) {
  const { user, loading: authLoading, checkAuth } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadUser = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const me = await getAuthSnapshot(checkAuth, user);
      return me;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load user');
      setError(error);
      throw error;
    } finally {
      setRefreshing(false);
    }
  }, [checkAuth, user]);

  useEffect(() => {
    if (autoLoad && !user && !authLoading) {
      void loadUser().catch(() => {});
    }
  }, [autoLoad, authLoading, loadUser, user]);

  useEffect(() => {
    if (user) {
      setError(null);
    }
  }, [user]);

  return {
    user,
    loading: refreshing || (autoLoad && authLoading && !user),
    error,
    loadUser,
    refresh: loadUser,
  };
}

/**
 * Derives display-oriented fields from the canonical auth snapshot.
 * Prefer useAuth() directly if you need the full user object.
 */
export function useUserProfile(autoLoad: boolean = true) {
  const { user, loading, error, refresh } = useUser(autoLoad);
  return {
    displayName: user?.display_name ?? null,
    email: user?.email ?? null,
    avatarUrl: user?.avatar_url ?? null,
    zipCode: (user?.preferences as Record<string, string> | undefined)?.zip_code ?? null,
    loading,
    error,
    refresh,
  };
}
