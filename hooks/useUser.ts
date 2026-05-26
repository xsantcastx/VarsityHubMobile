import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { getAuthSnapshot } from '@/utils/authState';

/**
 * Custom hook to load and access current user data
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
 * Custom hook to load user profile data (name, email, etc.)
 * Similar to useUser but returns extracted profile fields
 *
 * @param autoLoad - Whether to automatically load user on mount (default: true)
 * @returns Object containing profile fields, loading state, error, and refresh function
 */
export function useUserProfile(autoLoad: boolean = true) {
  const { user, loading, error, loadUser } = useUser(autoLoad);
  const profileUser = (user || null) as any;

  return {
    displayName: profileUser?.display_name || '',
    email: profileUser?.email || '',
    avatarUrl: profileUser?.avatar_url || null,
    zipCode: profileUser?.preferences?.zip_code || '',
    user,
    loading,
    error,
    refresh: loadUser,
  };
}
