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
 * publishes only if both teams resolve to known provider refs AND its venue
 * resolves to a coordinate. Anything else is quarantined and reported, never
 * published wrong.
 *
 * Railway cron suggestion: daily (`0 8 * * *`) keeps the configured window fresh.
 * DRY RUN by default; pass --apply (or ROLLING_APPLY=1) to write.
 *   PRO_SCHEDULE_PROVIDER=espn npx tsx src/cron/pro-schedule-rolling.ts --apply
 */
import { prisma } from '../lib/prisma.js';
import { NO_ADAPTER_MESSAGE, resolveConfiguredAdapter } from '../lib/proSchedule/adapters.js';
import { ingestLeague, type IngestStats } from '../lib/proSchedule/ingest.js';
import { getProScheduleWindowDays } from '../lib/proSchedule/window.js';

export async function runRollingScheduleIngest(opts: { apply?: boolean } = {}): Promise<void> {
  const apply =
    opts.apply ?? (process.argv.includes('--apply') || process.env.ROLLING_APPLY === '1');

  const adapter = resolveConfiguredAdapter();
  if (!adapter) {
    console.warn(NO_ADAPTER_MESSAGE);
    return;
  }

  const windowDays = getProScheduleWindowDays();
  const from = new Date();
  const to = new Date(from.getTime() + windowDays * 24 * 60 * 60 * 1000);
  console.log(
    `[pro-schedule-rolling] ${apply ? 'APPLY' : 'DRY RUN'} via ${adapter.name}, ` +
      `${adapter.leagues.join(',')} over ${windowDays}d ` +
      `(${from.toISOString()} → ${to.toISOString()})`
  );

  const failedLeagues: string[] = [];
  for (const league of adapter.leagues) {
    let runId: string | null = null;
    let stats: IngestStats | null = null;
    let failed = false;
    try {
      if (apply) {
        // intent: require a durable run record before importing so a recording
        // outage cannot create an apparently healthy, untraceable schedule run.
        const catalog = await prisma.sportsLeague.findUnique({
          where: { slug: league },
          select: { id: true },
        });
        const run = await prisma.sportsIngestRun.create({
          data: {
            sports_league_id: catalog?.id ?? null,
            // File adapters include the input path in their diagnostic name.
            // Store the provider identity without leaking paths or exceeding VARCHAR(60).
            provider: adapter.name.startsWith('json:') ? 'json' : adapter.name.slice(0, 60),
            status: 'running',
            window_from: from,
            window_to: to,
            message: `league=${league}`,
          },
        });
        runId = run.id;
      }
      stats = await ingestLeague(adapter, league, from, to, { dryRun: !apply });
      failed = stats.failures.length > 0;
    } catch (err) {
      // One league's provider failure must not abort the others.
      failed = true;
      console.error(
        `[pro-schedule-rolling] ${league} failed:`,
        err instanceof Error ? err.message : err
      );
    } finally {
      if (runId) {
        try {
          await prisma.sportsIngestRun.update({
            where: { id: runId },
            data: {
              status: stats ? (failed ? 'partial' : 'success') : 'failed',
              fetched_count: stats?.fetched ?? 0,
              created_count: stats?.created ?? 0,
              updated_count: stats?.updated ?? 0,
              skipped_count: stats?.skipped ?? 0,
              failure_count: stats?.failures.length ?? 1,
              finished_at: new Date(),
            },
          });
        } catch (error) {
          failed = true;
          console.error(`[pro-schedule-rolling] ${league} run recording failed:`, error);
        }
      }
    }
    if (failed) failedLeagues.push(league);
  }

  if (!apply) console.log('[pro-schedule-rolling] dry run — nothing written. Re-run with --apply.');
  // BullMQ observes promise rejection, not the CLI's process.exitCode. Finish
  // independent leagues first, then fail the job so monitoring/retries see it.
  if (failedLeagues.length > 0) {
    throw new Error(`Schedule ingest incomplete: ${failedLeagues.join(', ')}`);
  }
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
