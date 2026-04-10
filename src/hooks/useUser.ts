import { useCallback, useEffect, useState } from 'react';
import { User } from '@/api/entities';

/**
 * Custom hook to load and access current user data
 *
 * @param autoLoad - Whether to automatically load user on mount (default: true)
 * @returns Object containing user data, loading state, error, and refresh function
 */
export function useUser(autoLoad: boolean = true) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<Error | null>(null);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await User.me();
      setUser(me);
      return me;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load user');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      void loadUser();
    }
  }, [autoLoad, loadUser]);

  return {
    user,
    loading,
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

  return {
    displayName: user?.display_name || '',
    email: user?.email || '',
    avatarUrl: user?.avatar_url || null,
    zipCode: user?.preferences?.zip_code || '',
    user,
    loading,
    error,
    refresh: loadUser,
  };
}
