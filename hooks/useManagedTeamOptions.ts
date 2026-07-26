import { useCallback, useEffect, useState } from 'react';

// @ts-ignore - api/entities exports JS at runtime
import { Team } from '@/api/entities';
import { toUserMessage } from '@/utils/toUserMessage';

interface UseManagedTeamOptionsResult<T = any> {
  teams: T[];
  loading: boolean;
  error: string | null;
  refresh: (query?: string) => Promise<void>;
}

/**
 * Teams the signed-in user may actually act for — an organizer's whole
 * organization, or the specific teams a coach is assigned to (`GET
 * /teams/managed`, which mirrors `canManageAnyTeam` server-side).
 *
 * Use this for any "which of MY teams is this for?" picker. The sibling
 * `useTeamOptions` hook reads the PUBLIC team directory and must only be used
 * for discovery/opponent search — pointing a "your team" picker at it listed
 * every team on VarsityHub as if the user owned them.
 */
export function useManagedTeamOptions<T = any>(
  autoLoad: boolean = true
): UseManagedTeamOptionsResult<T> {
  const [teams, setTeams] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const res = await Team.managed(query);
      const list = Array.isArray(res) ? res : ((res as any)?.teams ?? (res as any)?.items ?? []);
      setTeams(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err: any) {
      if (__DEV__) console.error('[useManagedTeamOptions] failed', err);
      setError(toUserMessage(err, 'Unable to load your teams'));
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

export default useManagedTeamOptions;
