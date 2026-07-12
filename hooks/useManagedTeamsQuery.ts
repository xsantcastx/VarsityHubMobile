import { useQuery } from '@tanstack/react-query';
// @ts-ignore JS exports
import { Team as TeamApi } from '@/api/entities';

export type ManagedTeam = {
  id: string;
  name: string;
  members: number;
  status: 'active' | 'archived';
  sport?: string;
  season?: string;
  avatar_url?: string;
  my_role?: string;
  level: string | null;
  program_id: string | null;
  organization?: {
    id: string;
    name: string;
    description?: string;
    sport?: string;
  } | null;
};

/**
 * The single query behind the `['managed-teams', userId]` cache entry.
 * manage-teams and my-team both render from this key, so the queryFn (and the
 * mapped shape) must live in one place — two screens writing the same key with
 * different shapes would silently clobber each other's cache.
 */
export function useManagedTeamsQuery({
  userId,
  enabled,
}: {
  userId: string | undefined;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ['managed-teams', userId],
    enabled,
    queryFn: async (): Promise<ManagedTeam[]> => {
      const list: any[] = await TeamApi.managed();
      return list.map((t: any) => ({
        id: String(t.id),
        name: String(t.name || 'Team'),
        members: Number(t.members || t._count?.members || 0),
        status: (t.status || 'active') as any,
        sport: t.sport || null,
        season: t.season || null,
        avatar_url: t.avatar_url || null,
        my_role: t.my_role || null,
        level: t.level ?? null,
        program_id: t.program_id ?? null,
        organization: t.organization || null,
      }));
    },
  });
}
