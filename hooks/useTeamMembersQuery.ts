import { useQuery } from '@tanstack/react-query';
// @ts-ignore JS exports
import { Team as TeamApi } from '@/api/entities';

/**
 * The single query behind the `['team-members', teamId]` cache entry.
 * The cache stores the RAW TeamApi.members() response; each consumer maps it
 * to its own view model via `select`, so screens with different member shapes
 * (my-team roster vs team-contacts chat) share one entry without clobbering
 * each other. Pass a referentially stable `select` (useCallback/module fn) or
 * the mapped array identity changes every render.
 */
export function useTeamMembersQuery<TSelected>({
  teamId,
  enabled,
  select,
}: {
  teamId: string | null;
  enabled: boolean;
  select: (raw: any[]) => TSelected;
}) {
  return useQuery({
    queryKey: ['team-members', teamId],
    enabled,
    queryFn: async (): Promise<any[]> => {
      const list = await TeamApi.members(teamId as string);
      return Array.isArray(list) ? list : [];
    },
    select,
  });
}
