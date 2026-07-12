import { useQuery } from '@tanstack/react-query';
// @ts-ignore JS exports
import { Program as ProgramApi } from '@/api/entities';
import type { ProgramScreenSummary } from '@/api/schemas/program';

/**
 * Program screen-summary data, keyed by ['program-page', programId].
 */
export function useProgramScreenSummary(programId?: string | null) {
  return useQuery({
    queryKey: ['program-page', programId],
    enabled: !!programId,
    queryFn: (): Promise<ProgramScreenSummary> => ProgramApi.screenSummary(programId as string),
  });
}
