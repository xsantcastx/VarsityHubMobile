import { useAuth } from '@/context/AuthProvider';

/**
 * Minimal auth state: current user from AuthProvider.
 * Use for checking auth status, user id, or basic user info.
 * For refresh after mutations, use checkAuth from useAuth.
 */
export function useUser() {
  const { user, loading, checkAuth } = useAuth();
  return {
    user,
    loading,
    refresh: checkAuth,
  };
}

/**
 * Display subset of user for settings forms: displayName, email, zipCode.
 * Derives from useAuth().user — no separate fetch. Use checkAuth to refresh.
 */
export function useUserProfile() {
  const { user, loading, checkAuth } = useAuth();
  const prefs = (user?.preferences ?? {}) as Record<string, unknown>;
  return {
    displayName: (user as { display_name?: string })?.display_name ?? '',
    email: user?.email ?? '',
    zipCode: (prefs.zip_code ?? prefs.zip ?? '') as string,
    loading,
    refresh: checkAuth,
  };
}
