import { useQuery } from '@tanstack/react-query';
// @ts-ignore JS exports
import { Organization as OrganizationApi } from '@/api/entities';
import type { ProgramSummary } from '@/constants/programs';

export type OrgProgram = ProgramSummary & {
  teams: { id: string; name: string; level: string | null }[];
};

/**
 * Programs for a single organization, keyed by ['org-programs', organizationId].
 */
export function useOrgProgramsQuery({
  organizationId,
  enabled = true,
}: {
  organizationId?: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['org-programs', organizationId],
    enabled: enabled && !!organizationId,
    queryFn: async (): Promise<OrgProgram[]> => {
      const res: any = await OrganizationApi.programs(organizationId as string);
      return res?.programs ?? [];
    },
  });
}
