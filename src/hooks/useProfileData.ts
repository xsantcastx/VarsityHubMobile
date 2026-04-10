import { User } from '@/api/entities';
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
  themeColor: string;
  loadProfile: () => Promise<void>;
  updateAvatar: (avatarUrl: string) => void;
}

/**
 * Hook for managing user profile data (/me endpoint)
 * Handles session validation, user data fetching, and theme color extraction
 */
export function useProfileData(): UseProfileDataResult {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState('#3B82F6'); // Default VarsityHub Blue
  const requestInFlight = useRef(false);

  const loadProfile = useCallback(async () => {
    // Prevent duplicate requests
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      // Fetch current user session
      const user: any = await User.me();

      // Only update if response is not a 304 Not Modified
      if (user && !user._isNotModified) {
        setMe(user ?? null);

        // Extract and set theme color
        const color = user?.preferences?.theme_color || '#3B82F6';
        setThemeColor(color);
      }

      // If no valid user, clear state
      if (!user?.id) {
        setMe(null);
        setLoading(false);
        return;
      }
    } catch (e: any) {
      console.error('[useProfileData] Failed to load profile', e);

      // Handle 401 Unauthorized specifically
      if (e && e.status === 401) {
        setError('You need to sign in to view your profile.');
      } else {
        setError(e?.message ? `Unable to load profile: ${e.message}` : 'Unable to load profile.');
      }
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, []);

  const updateAvatar = useCallback((avatarUrl: string) => {
    setMe(prev => (prev ? { ...prev, avatar_url: avatarUrl } : null));
  }, []);

  return {
    me,
    loading,
    error,
    themeColor,
    loadProfile,
    updateAvatar,
  };
}
