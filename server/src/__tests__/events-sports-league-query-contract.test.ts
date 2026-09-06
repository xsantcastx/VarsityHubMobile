import { readFileSync } from 'node:fs';
import path from 'node:path';

const eventsRoute = readFileSync(path.join(process.cwd(), 'src/routes/events.ts'), 'utf8');
const clientEntities = readFileSync(path.join(process.cwd(), '../apiclient/entities.ts'), 'utf8');
const eventSchema = readFileSync(path.join(process.cwd(), '../apiclient/schemas/event.ts'), 'utf8');
const feedScreen = readFileSync(path.join(process.cwd(), '../app/feed.tsx'), 'utf8');

describe('events sports league query contract', () => {
  it('serializes data-driven league metadata while preserving pro_league', () => {
    for (const field of [
      'sports_league_id',
      'league_slug',
      'league_name',
      'league_level',
      'league_gender',
      'pro_league',
    ]) {
      expect(eventsRoute).toContain(`${field}:`);
      expect(eventSchema).toContain(field);
    }
  });

  it('accepts league metadata filters in the server and client', () => {
    for (const field of ['sports_league_id', 'league_slug', 'sport', 'level', 'gender']) {
      expect(eventsRoute).toContain(`req.query.${field}`);
      expect(clientEntities).toContain(`${field}?: string`);
      expect(clientEntities).toContain(`${field}=`);
    }
  });

  it('exposes a bounded public sports league catalog endpoint', () => {
    expect(eventsRoute).toContain("'/sports-leagues'");
    expect(eventsRoute).toContain('prisma.sportsLeague.findMany');
    expect(eventsRoute).toContain('active: true');
    expect(eventsRoute).toContain('Math.min(limitRaw, 300)');
    expect(eventsRoute).toContain('schedule_status:');
    expect(eventsRoute).toContain('has_current_events:');
    expect(eventsRoute).toContain('current_event_count:');
    expect(eventsRoute).toContain('getSportsLeagueScheduleStatus');
    expect(clientEntities).toContain('sportsLeagues:');
    expect(clientEntities).toContain("httpGet('/events/sports-leagues'");
    expect(clientEntities).toContain('SportsLeagueScheduleStatus');
  });

  it('keeps pro_league compatible with both ProTeam and SportsLeague rows', () => {
    expect(eventsRoute).toMatch(/proHomeTeam: \{ is: \{ league: proLeague \} \}/);
    expect(eventsRoute).toMatch(/proAwayTeam: \{ is: \{ league: proLeague \} \}/);
    expect(eventsRoute).toMatch(/sportsLeague: \{ is: \{ slug: proLeague \} \}/);
  });

  it('keeps feed external-event loading backend-driven instead of league-special-cased', () => {
    expect(feedScreen).not.toContain('PRO_SPOTLIGHT_LEAGUES');
    expect(feedScreen).not.toContain('NCAA_FEED_LEAGUES');
    expect(feedScreen).not.toContain('feed-pro-events-upcoming-wwe');
    expect(feedScreen).not.toContain('feed-pro-events-upcoming-nfl');
    expect(feedScreen).toContain('fetchDiscoveryItems');
  });
});
