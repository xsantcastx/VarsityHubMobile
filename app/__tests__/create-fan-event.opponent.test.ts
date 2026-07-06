/**
 * "vs TBD" root cause guard: an opponent picked from the suggestions
 * dropdown must produce a LINKED payload on the side the user's team is
 * NOT on, while free-typed text stays a display-only placeholder.
 *
 * Why this exists: the July 4th round fixed opponent linkage in
 * manage-season's handleSaveGame but missed this second creation surface,
 * and the round's verification script only exercised the server contract
 * (hand-built HTTP payloads) — so no client-layer test caught the gap.
 * Server contract verified in server/scripts/july4-notes-verification.ts A/B.
 */
import { buildOpponentLink } from '@/utils/gameOpponent';

describe('buildOpponentLink', () => {
  it('links the opponent as AWAY when the user team is home', () => {
    expect(buildOpponentLink('home', 'team-123')).toEqual({ away_team_id: 'team-123' });
  });

  it('links the opponent as HOME when the user team is away', () => {
    expect(buildOpponentLink('away', 'team-123')).toEqual({ home_team_id: 'team-123' });
  });

  it('returns nothing for free-typed opponents (no id)', () => {
    expect(buildOpponentLink('home', '')).toEqual({});
    expect(buildOpponentLink('away', '   ')).toEqual({});
  });

  it('returns nothing for unknown game types', () => {
    expect(buildOpponentLink('neutral', 'team-123')).toEqual({});
  });
});
