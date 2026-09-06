import { getCatalogHealth } from '../lib/sportsCatalogHealth.js';
const now = new Date('2026-09-06T12:00:00Z');
const run = {
  status: 'success',
  fetched_count: 0,
  failure_count: 0,
  started_at: now,
  finished_at: now,
};
const input = { supported: true, currentEvents: 0, latestRun: run, now };
it('does not label an empty or never-run provider as offseason', () => {
  expect(getCatalogHealth(input)).toBe('EMPTY_UNVERIFIED');
  expect(getCatalogHealth({ ...input, latestRun: null })).toBe('STALE_IMPORT');
});
it('requires successful empty import and explicit season dates for offseason', () => {
  const confirmedSeason = { starts_on: new Date('2026-10-01'), ends_on: new Date('2027-01-01') };
  expect(getCatalogHealth({ ...input, confirmedSeason })).toBe('OFFSEASON_NO_EVENTS');
  expect(
    getCatalogHealth({ ...input, confirmedSeason, latestRun: { ...run, status: 'failed' } })
  ).toBe('STALE_IMPORT');
});
it('reports outages even when old events remain visible', () => {
  expect(
    getCatalogHealth({ ...input, currentEvents: 10, latestRun: { ...run, failure_count: 1 } })
  ).toBe('STALE_IMPORT');
  expect(
    getCatalogHealth({ ...input, latestRun: { ...run, finished_at: new Date('2026-09-01') } })
  ).toBe('STALE_IMPORT');
});
it('distinguishes event seeds, supported synchronization and unsupported catalogs', () => {
  expect(getCatalogHealth({ ...input, supported: false })).toBe('UNSUPPORTED_PROVIDER');
  expect(getCatalogHealth({ ...input, supported: false, currentEvents: 2 })).toBe('SEEDED_EVENTS');
  expect(getCatalogHealth({ ...input, currentEvents: 2 })).toBe('ACTIVE_SYNCING');
});
it('treats a stalled running import and discarded fixtures as unhealthy', () => {
  expect(
    getCatalogHealth({
      ...input,
      latestRun: {
        ...run,
        status: 'running',
        finished_at: null,
        started_at: new Date('2026-09-06T11:00:00Z'),
      },
    })
  ).toBe('STALE_IMPORT');
  expect(getCatalogHealth({ ...input, latestRun: { ...run, fetched_count: 5 } })).toBe(
    'STALE_IMPORT'
  );
});
