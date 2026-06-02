import { runAdsStartupBackfill } from '../routes/ads.js';
import { runEventsStartupBackfill } from '../routes/events.js';
import { runGamesStartupBackfill } from '../routes/games.js';

export async function runRouteStartupBackfills(): Promise<void> {
  await Promise.all([
    runAdsStartupBackfill(),
    runEventsStartupBackfill(),
    runGamesStartupBackfill(),
  ]);
}
