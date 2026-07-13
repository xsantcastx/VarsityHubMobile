import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

const indexSrc = read('src/index.ts');
const eventsSrc = read('src/routes/events.ts');
const gamesSrc = read('src/routes/games.ts');
const adsSrc = read('src/routes/ads.ts');

describe('startup side-effect guards', () => {
  it('keeps route backfills behind explicit exported functions instead of import-time execution', () => {
    expect(eventsSrc).toContain('export async function runEventsStartupBackfill(): Promise<void>');
    expect(gamesSrc).toContain('export async function runGamesStartupBackfill(): Promise<void>');
    expect(adsSrc).toContain('export async function runAdsStartupBackfill(): Promise<void>');
    expect(eventsSrc).not.toContain('if (shouldRunStartupBackfills)');
    expect(gamesSrc).not.toContain('if (shouldRunStartupBackfills)');
    expect(adsSrc).not.toContain('if (shouldRunStartupBackfills)');
  });

  it('runs route backfills from the explicit startup entrypoint', () => {
    expect(indexSrc).toContain(
      "import { runRouteStartupBackfills } from './startup/routeBackfills.js';"
    );
    // Backfills are invoked at startup, now wrapped in runClusterOnce so they
    // run on a single replica only (multi-replica safety) instead of every one.
    expect(indexSrc).toContain('await runRouteStartupBackfills();');
    expect(indexSrc).toContain("runClusterOnce('route-startup-backfills'");
  });
});
