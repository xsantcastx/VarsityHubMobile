import { useCallback, useEffect, useState } from 'react';

// @ts-ignore - api/entities exports JS at runtime
import { Team } from '@/api/entities';

interface UseTeamOptionsResult<T = any> {
  teams: T[];
  loading: boolean;
  error: string | null;
  refresh: (query?: string) => Promise<void>;
}

/**
 * Shared hook for loading VarsityHub teams.
 * Handles loading/error state plus exposes a refresh function with optional query filtering.
 */
export function useTeamOptions<T = any>(autoLoad: boolean = true): UseTeamOptionsResult<T> {
  const [teams, setTeams] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const res = await Team.list(query);
      setTeams(Array.isArray(res) ? res : []);
      setError(null);
    } catch (err: any) {
      console.error('[useTeamOptions] failed', err);
      // Don't show authentication errors as hard failures - user might not be fully logged in yet
      const isAuthError = err?.message?.toLowerCase().includes('auth') || err?.status === 401;
      if (!isAuthError) {
        setError(err?.message || 'Unable to load teams');
      } else {
        setError(null); // Silently fail for auth errors
      }
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      refresh().catch(() => {});
    }
  }, [autoLoad, refresh]);

  return { teams, loading, error, refresh };
}

export default useTeamOptions;
