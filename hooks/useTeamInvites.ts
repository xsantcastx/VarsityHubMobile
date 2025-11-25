import { useCallback, useEffect, useState } from 'react';

// @ts-ignore runtime export
import { Team } from '@/api/entities';

export interface UseTeamInvitesResult<T = any> {
  invites: T[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTeamInvites<T = any>(autoLoad: boolean = true): UseTeamInvitesResult<T> {
  const [invites, setInvites] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await Team.myInvites();
      setInvites(Array.isArray(list) ? (list as T[]) : []);
      setError(null);
    } catch (err: any) {
      console.error('[useTeamInvites] failed', err);
      setError(err?.message || 'Unable to load invites');
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      refresh().catch(() => {});
    }
  }, [autoLoad, refresh]);

  return { invites, loading, error, refresh };
}

export default useTeamInvites;
