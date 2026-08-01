import { describe, expect, it } from '@jest/globals';
import {
  isReservedUsername,
  normalizeUsername,
  reservedUsernamesForTest,
} from '../lib/reservedUsernames.js';

describe('reserved usernames', () => {
  describe('platform identities', () => {
    it.each(['varsityhub', 'admin', 'support', 'moderator', 'official', 'noreply'])(
      'reserves %s',
      name => {
        expect(isReservedUsername(name)).toBe(true);
      }
    );
  });

  describe('league marks', () => {
    it.each(['nfl', 'nba', 'wnba', 'mlb', 'wwe'])('reserves %s', name => {
      expect(isReservedUsername(name)).toBe(true);
    });
  });

  describe('franchise full names', () => {
    it.each([
      'newyorkyankees',
      'losangeleslakers',
      'greenbaypackers',
      'bostonceltics',
      'seattlestorm',
      'indianafever',
    ])('reserves %s', name => {
      expect(isReservedUsername(name)).toBe(true);
    });
  });

  describe('city-initial forms — the handles a squatter actually reaches for', () => {
    it.each([
      ['nyyankees', 'New York Yankees'],
      ['lalakers', 'Los Angeles Lakers'],
      ['sfgiants', 'San Francisco Giants'],
      ['lvraiders', 'Las Vegas Raiders'],
      ['kcchiefs', 'Kansas City Chiefs'],
    ])('reserves %s (%s)', handle => {
      expect(isReservedUsername(handle)).toBe(true);
    });
  });

  describe('distinctive bare nicknames', () => {
    it.each(['lakers', 'yankees', 'steelers', 'packers', 'celtics', 'dodgers'])(
      'reserves %s',
      name => {
        expect(isReservedUsername(name)).toBe(true);
      }
    );
  });

  describe('normalization defeats punctuation evasion', () => {
    it.each(['ny_yankees', 'n.y.yankees', 'NY_YANKEES', 'la.lakers', 'l_a_k_e_r_s'])(
      'catches %s',
      name => {
        expect(isReservedUsername(name)).toBe(true);
      }
    );
  });

  describe('deliberately NOT reserved', () => {
    // These are ordinary English words before they are marks. Blocking them
    // would deny handles to real users for no impersonation benefit — "@storm"
    // asserts nothing, "@seattlestorm" does. This is a product decision, not an
    // oversight: if one becomes a real problem, add it to DISTINCTIVE_NICKNAMES.
    it.each([
      'heat',
      'magic',
      'storm',
      'dream',
      'sky',
      'sun',
      'kings',
      'thunder',
      'jazz',
      'fire',
      'wings',
      'aces',
      'sparks',
    ])('leaves %s claimable', name => {
      expect(isReservedUsername(name)).toBe(false);
    });

    it.each(['emil', 'coachmike', 'varsity_dad', 'jsmith', 'team_parent99'])(
      'leaves ordinary handle %s claimable',
      name => {
        expect(isReservedUsername(name)).toBe(false);
      }
    );
  });

  describe('edge cases', () => {
    it('treats null and empty as not reserved (other validators handle those)', () => {
      expect(isReservedUsername(null)).toBe(false);
      expect(isReservedUsername(undefined)).toBe(false);
      expect(isReservedUsername('')).toBe(false);
    });

    it('never contains an empty string, which would reject every handle', () => {
      expect(reservedUsernamesForTest().has('')).toBe(false);
    });

    it('normalizes by stripping non-alphanumerics and lowercasing', () => {
      expect(normalizeUsername('N.Y._Yankees')).toBe('nyyankees');
    });
  });

  describe('coverage sanity', () => {
    it('derives an entry for every seeded franchise, so a new team is covered automatically', async () => {
      const { PRO_TEAM_SEED } = await import('../lib/proTeams.js');
      for (const team of PRO_TEAM_SEED) {
        expect(isReservedUsername(team.name)).toBe(true);
      }
    });
  });
});
