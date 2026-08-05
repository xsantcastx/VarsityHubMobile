import { prisma } from '../lib/prisma.js';
import { ingestFixtures } from '../lib/proSchedule/ingest.js';
import { WWE_FIXTURES_2026 } from '../lib/proSchedule/wweSchedule2026.js';
import { PRO_TEAM_SEED } from '../lib/proTeams.js';

/**
 * One-time rollout of the pro-sports data layer.
 *
 * Production shipped the pro-sports CODE and tables but was NEVER seeded — zero
 * pro teams for any league — so pro team pages, matchup colors, and WWE event
 * pages never appeared. This seeds the franchises + the WWE promotion and
 * ingests the curated WWE schedule so those pages exist.
 *
 * Runs only when PRO_SPORTS_BOOTSTRAP=1 (set deliberately for a rollout deploy),
 * on a single replica (called under runClusterOnce in index.ts), and is fully
 * idempotent — proTeam upsert on external_ref + event upsert on
 * pro_external_ref, so a re-run (or leaving the flag on) is a safe no-op. Never
 * fatal: a failure here must not take down server startup.
 */
export async function runProSportsBootstrap(): Promise<void> {
  if (process.env.PRO_SPORTS_BOOTSTRAP !== '1') return;
  try {
    // 1) Seed the pro franchises + the WWE promotion. Mirrors seed-pro-teams.ts.
    let teams = 0;
    for (const t of PRO_TEAM_SEED) {
      const { external_ref, ...data } = t;
      await prisma.proTeam.upsert({
        where: { external_ref },
        create: { external_ref, ...data },
        update: data,
      });
      teams += 1;
    }
    console.log(`[pro-bootstrap] seeded/updated ${teams} pro teams`);

    // 2) Ingest the curated WWE schedule (touring shows -> Event rows pinned to
    //    the WWE promotion). Idempotent on Event.pro_external_ref.
    const stats = await ingestFixtures('wwe', WWE_FIXTURES_2026);
    console.log(
      `[pro-bootstrap] WWE ingest: fetched=${stats.fetched} created=${stats.created} ` +
        `updated=${stats.updated} skipped=${stats.skipped}`
    );
    if (stats.failures.length) {
      console.warn(
        '[pro-bootstrap] WWE ingest skips:',
        stats.failures.slice(0, 10).map(f => `${f.external_ref}: ${f.reason}`)
      );
    }
  } catch (err) {
    console.error('[pro-bootstrap] failed (non-fatal):', err);
  }
}
