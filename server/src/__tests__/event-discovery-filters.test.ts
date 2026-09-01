import { describe, expect, it, jest } from '@jest/globals';
import { listEventDiscoveryItems } from '../lib/eventDiscovery.js';

const now = new Date('2026-09-01T12:00:00.000Z');

// No `team` model on the mock → loadExcludedPrivateTeamIds returns an empty set
// (no private-team exclusion), keeping this focused on sport/type filtering.
function makeDb() {
  return {
    game: {
      findMany: jest.fn(async () => [
        {
          id: 'g-bball',
          title: 'Hoops',
          date: new Date('2026-09-02T20:00:00.000Z'),
          latitude: 1,
          longitude: 1,
          home_team_id: 't1',
          away_team_id: null,
          events: [],
          homeTeam: { sport: 'basketball' },
          awayTeam: null,
        },
        {
          id: 'g-fball',
          title: 'Gridiron',
          date: new Date('2026-09-02T20:00:00.000Z'),
          latitude: 1,
          longitude: 1,
          home_team_id: 't2',
          away_team_id: null,
          events: [],
          homeTeam: { sport: 'football' },
          awayTeam: null,
        },
      ]),
    },
    event: {
      findMany: jest.fn(async () => [
        {
          id: 'e-bball',
          title: 'Hoops Watch Party',
          date: new Date('2026-09-03T00:00:00.000Z'),
          latitude: 1,
          longitude: 1,
          team_id: 't3',
          team: { sport: 'basketball' },
          proHomeTeam: null,
          proAwayTeam: null,
          status: 'published',
        },
      ]),
    },
    eventDesignatedPoster: { findMany: jest.fn(async () => []) },
    eventPostingUnlock: { findMany: jest.fn(async () => []) },
  } as any;
}

describe('event discovery — sport/type filters', () => {
  it('returns everything when no filter is supplied', async () => {
    const r = await listEventDiscoveryItems(makeDb(), { now });
    expect(r.items.map((i: any) => i.id).sort()).toEqual(['e-bball', 'g-bball', 'g-fball']);
  });

  it('type filters to a single source_type', async () => {
    const r = await listEventDiscoveryItems(makeDb(), { type: 'event', now });
    expect(r.items.every((i: any) => i.source_type === 'event')).toBe(true);
    expect(r.items.map((i: any) => i.id)).toEqual(['e-bball']);
  });

  it('sport filters (normalized) to the matching sport across games and events', async () => {
    const r = await listEventDiscoveryItems(makeDb(), { sport: 'basketball', now });
    expect(r.items.map((i: any) => i.id).sort()).toEqual(['e-bball', 'g-bball']);
  });
});
