import { Game } from '@/api/entities';
import { useCallback, useEffect, useState } from 'react';

export type GameListOptions = {
  cursor?: string | null;
  limit?: number;
  lat?: number;
  lng?: number;
  distance?: number;
  dateFrom?: string;
  dateTo?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  showPending?: boolean;
};

export function useGameList(
  sort: string = '-date',
  options?: GameListOptions,
  { enabled = true } = {}
) {
  const [games, setGames] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<{ games: any[]; cursor: string | null }> => {
    setLoading(true);
    setError(null);
    try {
      const result = await Game.list(sort, options);
      const list = Array.isArray(result) ? result : (result?.items ?? []);
      const nextCursor = result && typeof result === 'object' && 'nextCursor' in result ? (result as any).nextCursor : null;
      setGames(list);
      setCursor(nextCursor);
      return { games: list, cursor: nextCursor };
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load games');
      setGames([]);
      setCursor(null);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [sort, options?.cursor, options?.limit, options?.lat, options?.lng, options?.distance, options?.dateFrom, options?.dateTo, options?.approvalStatus, options?.showPending]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const result = await Game.list(sort, { ...options, cursor });
      const list = Array.isArray(result) ? result : (result?.items ?? []);
      const nextCursor = result && typeof result === 'object' && 'nextCursor' in result ? (result as any).nextCursor : null;
      setGames(prev => [...prev, ...list]);
      setCursor(nextCursor);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load more games');
    } finally {
      setLoading(false);
    }
  }, [sort, cursor, options?.limit, options?.lat, options?.lng, options?.distance, options?.dateFrom, options?.dateTo, options?.approvalStatus, options?.showPending]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return {
    games,
    loading,
    error,
    refresh: load,
    loadMore,
    hasMore: !!cursor,
    cursor,
  };
}
