/**
 * Rolling pro-schedule ingest — all leagues, preseason-safe horizon.
 *
 * Every run pulls each league's games in the next WINDOW_DAYS from the
 * configured provider (ESPN) and upserts them as Event pages. Idempotent on
 * Event.pro_external_ref, so re-running corrects moved/postponed games and adds
 * newly-scheduled ones — that is what makes the pages stay accurate as the
 * calendar advances. Offseason leagues simply return no games.
 *
 * Accuracy is per-game and enforced downstream in resolveFixture: a game
 * publishes only if both teams map to seeded refs AND its venue resolves to a
 * coordinate. Anything else is quarantined and reported, never published wrong.
 *
 * Railway cron suggestion: daily (`0 8 * * *`) keeps the configured window fresh.
 * DRY RUN by default; pass --apply (or ROLLING_APPLY=1) to write.
 *   PRO_SCHEDULE_PROVIDER=espn npx tsx src/cron/pro-schedule-rolling.ts --apply
 */
import { prisma } from '../lib/prisma.js';
import { NO_ADAPTER_MESSAGE, resolveConfiguredAdapter } from '../lib/proSchedule/adapters.js';
import { ingestLeague } from '../lib/proSchedule/ingest.js';
import { getProScheduleWindowDays } from '../lib/proSchedule/window.js';

export async function runRollingScheduleIngest(opts: { apply?: boolean } = {}): Promise<void> {
  const apply =
    opts.apply ?? (process.argv.includes('--apply') || process.env.ROLLING_APPLY === '1');

  const adapter = resolveConfiguredAdapter();
  if (!adapter) {
    console.warn(NO_ADAPTER_MESSAGE);
    return;
  }

  const from = new Date();
  console.log(
    `[pro-schedule-rolling] ${apply ? 'APPLY' : 'DRY RUN'} via ${adapter.name}, ` +
      `${adapter.leagues.join(',')} (per-league window, from ${from.toISOString()})`
  );

  let totalFailures = 0;
  for (const league of adapter.leagues) {
    // Window is resolved per league, so MLS NEXT Pro can roll on 14 days while
    // the others keep 45 — same `from`, a league-specific `to`.
    const windowDays = getProScheduleWindowDays(process.env, undefined, league);
    const to = new Date(from.getTime() + windowDays * 24 * 60 * 60 * 1000);
    try {
      const stats = await ingestLeague(adapter, league, from, to, { dryRun: !apply });
      totalFailures += stats.failures.length;
    } catch (err) {
      // One league's provider failure must not abort the others.
      totalFailures += 1;
      console.error(
        `[pro-schedule-rolling] ${league} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (!apply) console.log('[pro-schedule-rolling] dry run — nothing written. Re-run with --apply.');
  if (totalFailures > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runRollingScheduleIngest()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch(err => {
      console.error('[pro-schedule-rolling] fatal:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
