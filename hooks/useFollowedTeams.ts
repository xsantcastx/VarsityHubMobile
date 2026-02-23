import { httpGet } from '@/api/http';
import { useCallback, useEffect, useState } from 'react';

export function useFollowedTeams() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await httpGet('/follows/teams?user_id=me');
      setTeams(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load teams');
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { teams, loading, error, refresh: load };
}
