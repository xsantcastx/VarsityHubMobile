import type { ProLeague } from '@prisma/client';
import type { ProFixture, ProScheduleAdapter } from './types.js';

/**
 * Routes each league to the sub-adapter that serves it, so one adapter can span
 * sources — ESPN for scoreboard-backed sports, TheSportsDB for touring WWE.
 * The first sub-adapter that lists a league wins it. Downstream (cron, ingest)
 * sees one adapter for the currently configured live sources.
 */
export function compositeAdapter(subs: ProScheduleAdapter[]): ProScheduleAdapter {
  const byLeague = new Map<ProLeague, ProScheduleAdapter>();
  for (const sub of subs) {
    for (const league of sub.leagues) {
      if (!byLeague.has(league)) byLeague.set(league, sub);
    }
  }

  return {
    name: `composite(${subs.map(s => s.name).join('+')})`,
    leagues: [...byLeague.keys()],
    async fetchFixtures(league: ProLeague, from: Date, to: Date): Promise<ProFixture[]> {
      const sub = byLeague.get(league);
      return sub ? sub.fetchFixtures(league, from, to) : [];
    },
  };
}
