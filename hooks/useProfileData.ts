import { useAuth } from '@/context/AuthProvider';
import { useCallback, useRef, useState } from 'react';

export interface CurrentUser {
  id: string;
  email?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  preferences?: {
    role?: string | null;
    plan?: string | null;
    theme_color?: string;
  };
  _count?: {
    posts?: number;
    followers?: number;
    following?: number;
  };
}

export interface UseProfileDataResult {
  me: CurrentUser | null;
  loading: boolean;
  error: string | null;
  loadProfile: () => Promise<void>;
  updateAvatar: (avatarUrl: string) => void;
}

/**
 * Profile screen data: current user, loadProfile, updateAvatar.
 * Uses useAuth as source of truth. loadProfile calls checkAuth.
 * updateAvatar provides optimistic local override for avatar URL.
 */
export function useProfileData(): UseProfileDataResult {
  const { user: authUser, checkAuth } = useAuth();
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const me: CurrentUser | null = authUser
    ? {
        ...authUser,
        avatar_url: avatarOverride ?? (authUser as any).avatar_url,
      } as CurrentUser
    : null;

  const loadProfile = useCallback(async () => {
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    setLoading(true);
    setError(null);
    setAvatarOverride(null);

    try {
      await checkAuth();
    } catch (e: any) {
      console.error('[useProfileData] Failed to load profile', e);
      if (e?.status === 401) {
        setError('You need to sign in to view your profile.');
      } else {
        setError(e?.message ? `Unable to load profile: ${e.message}` : 'Unable to load profile.');
      }
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [checkAuth]);

  const updateAvatar = useCallback((avatarUrl: string) => {
    setAvatarOverride(avatarUrl);
  }, []);

  return {
    me,
    loading,
    error,
    loadProfile,
    updateAvatar,
  };
}
