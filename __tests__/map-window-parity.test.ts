/**
 * Map window parity guard.
 *
 * The map shows the SAME rolling forward window for games AND events, and it
 * must match the feed. That window is defined in THREE places that compile
 * independently and have silently drifted before (the "further than two weeks"
 * bug shipped because the 2-week fix bounded games but not events):
 *
 *   1. client — utils/mapEventFilters.ts        (MAP_WINDOW_DAYS)
 *   2. server — routes/games.ts   map_view       (twoWeeksFromNow)
 *   3. server — routes/events.ts  map_view        (twoWeeksFromNow)
 *
 * If any one changes, this test fails so all three are updated together.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAP_WINDOW_DAYS } from '../utils/mapEventFilters';

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

describe('map window parity (client ↔ server games ↔ server events)', () => {
  it('client MAP_WINDOW_DAYS is 14', () => {
    expect(MAP_WINDOW_DAYS).toBe(14);
  });

  it('the server games map_view window is +14 days', () => {
    const games = read('server', 'src', 'routes', 'games.ts');
    expect(games).toContain('14 * 24 * 60 * 60 * 1000');
  });

  it('the server events map_view window is +14 days (must match games)', () => {
    const events = read('server', 'src', 'routes', 'events.ts');
    expect(events).toContain('14 * 24 * 60 * 60 * 1000');
  });
});
