/** Coverage is derived from the provider/run ledger; zero rows alone never mean offseason. */
export type CatalogHealth =
  | 'ACTIVE_SYNCING'
  | 'UNSUPPORTED_PROVIDER'
  | 'OFFSEASON_NO_EVENTS'
  | 'STALE_IMPORT'
  | 'EMPTY_UNVERIFIED'
  | 'SEEDED_EVENTS';
type Run = {
  status: string;
  fetched_count: number;
  failure_count: number;
  started_at: Date;
  finished_at: Date | null;
};
export function getCatalogHealth(input: {
  supported: boolean;
  currentEvents: number;
  latestRun?: Run | null;
  confirmedSeason?: { starts_on: Date | null; ends_on: Date | null } | null;
  now?: Date;
}): CatalogHealth {
  const now = input.now ?? new Date();
  if (!input.supported) return input.currentEvents > 0 ? 'SEEDED_EVENTS' : 'UNSUPPORTED_PROVIDER';
  const run = input.latestRun;
  if (!run) return 'STALE_IMPORT';
  const age = now.getTime() - (run.finished_at ?? run.started_at).getTime();
  if (
    age < 0 ||
    age > 36 * 60 * 60 * 1000 ||
    run.failure_count > 0 ||
    !['running', 'success'].includes(run.status)
  )
    return 'STALE_IMPORT';
  if (run.status === 'running') return age <= 30 * 60 * 1000 ? 'ACTIVE_SYNCING' : 'STALE_IMPORT';
  if (!run.finished_at) return 'STALE_IMPORT';
  if (input.currentEvents > 0) return 'ACTIVE_SYNCING';
  if (run.fetched_count > 0) return 'STALE_IMPORT';
  const season = input.confirmedSeason;
  if (
    season?.starts_on &&
    season.ends_on &&
    season.starts_on <= season.ends_on &&
    (now < season.starts_on || now > season.ends_on)
  )
    return 'OFFSEASON_NO_EVENTS';
  return 'EMPTY_UNVERIFIED';
}
