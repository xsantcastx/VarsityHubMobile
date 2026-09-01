import { describe, expect, it, jest } from '@jest/globals';
import { listEventDiscoveryItems } from '../lib/eventDiscovery.js';

const now = new Date('2026-09-01T12:00:00.000Z');

function makeDb(followedTeamId: string) {
  return {
    teamFollow: { findMany: jest.fn(async () => [{ team_id: followedTeamId }]) },
    teamMembership: { findMany: jest.fn(async () => []) },
    organizationMembership: { findMany: jest.fn(async () => []) },
    team: { findMany: jest.fn(async () => []) },
    game: {
      findMany: jest.fn(async () => [
        {
          id: 'g-followed',
          title: 'Mine',
          date: new Date('2026-09-25T00:00:00.000Z'), // 24 days out — beyond the public 5-day clamp
          latitude: 1,
          longitude: 1,
          home_team_id: 'team-X',
          away_team_id: null,
          events: [],
          homeTeam: { sport: 'soccer' },
          awayTeam: null,
        },
        {
          id: 'g-other',
          title: 'Not mine',
          date: new Date('2026-09-03T00:00:00.000Z'),
          latitude: 1,
          longitude: 1,
          home_team_id: 'team-Y',
          away_team_id: null,
          events: [],
          homeTeam: { sport: 'soccer' },
          awayTeam: null,
        },
      ]),
    },
    event: { findMany: jest.fn(async () => []) },
    eventDesignatedPoster: { findMany: jest.fn(async () => []) },
    eventPostingUnlock: { findMany: jest.fn(async () => []) },
  } as any;
}

describe('event discovery — following scope', () => {
  it("returns only the viewer's followed/managed teams, unclamped to 5 days", async () => {
    const result = await listEventDiscoveryItems(makeDb('team-X'), {
      scope: 'following',
      viewerId: 'viewer-1',
      now,
    });
    // team-Y game excluded (not followed); team-X game present.
    expect(result.items.map((i: any) => i.id)).toEqual(['g-followed']);
    // The window itself must be future-only and unbounded, NOT the public
    // 5-day clamp (assert on meta since the mock ignores the WHERE clause).
    const spanMs =
      new Date(result.meta.to).getTime() - new Date(result.meta.from).getTime();
    expect(spanMs).toBeGreaterThan(30 * 24 * 60 * 60 * 1000);
    expect(new Date(result.meta.from).getTime()).toBe(now.getTime());
  });

  it('returns empty items for a null viewer, without throwing', async () => {
    const result = await listEventDiscoveryItems(makeDb('team-X'), {
      scope: 'following',
      viewerId: null,
      now,
    });
    expect(result.items).toEqual([]);
  });
});
