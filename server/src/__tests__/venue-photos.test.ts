import { venuePhotoFor, leagueDefaultPhoto, VENUE_PHOTOS } from '../lib/proSchedule/venuePhotos.js';
import { PRO_TEAM_SEED } from '../lib/proTeams.js';

describe('venuePhotoFor', () => {
  it('resolves the WNBA venues that were previously blank', () => {
    for (const venue of [
      'Gateway Center Arena',
      'College Park Center',
      'Michelob Ultra Arena',
      'Climate Pledge Arena',
      'Coca-Cola Coliseum',
    ]) {
      expect(venuePhotoFor(venue)?.url).toBeTruthy();
    }
  });

  it('resolves the WWE touring arenas that have real photos', () => {
    for (const venue of ['KeyBank Center', 'Canada Life Place', 'SNHU Arena', 'Scope Arena']) {
      expect(venuePhotoFor(venue)?.url).toBeTruthy();
    }
  });

  it('matches on the venue-name segment before the first comma, case-insensitively', () => {
    expect(venuePhotoFor('scope arena, Norfolk, VA')?.url).toBe(VENUE_PHOTOS['Scope Arena'].url);
  });

  it('every mapped venue carries a non-empty attribution credit', () => {
    for (const photo of Object.values(VENUE_PHOTOS)) {
      expect(typeof photo.credit).toBe('string');
      expect(photo.credit.length).toBeGreaterThan(0);
    }
  });
});

describe('leagueDefaultPhoto', () => {
  it('gives WWE a branded default so a teamless touring show is never blank', () => {
    const def = leagueDefaultPhoto('wwe');
    expect(def?.url).toBeTruthy();
    expect(def?.credit).toBeTruthy();
  });

  it('a WWE show at an unmapped convention center still resolves to an image', () => {
    // Real 2026-slate stop with no Commons photo — must fall back, not go blank.
    const venuePhoto = venuePhotoFor('Wicomico Youth & Civic Center, Salisbury, MD');
    const resolved = venuePhoto ?? leagueDefaultPhoto('wwe');
    expect(resolved?.url).toBeTruthy();
  });

  it('leagues with permanent mapped venues have no default (fall through to null)', () => {
    for (const league of ['nfl', 'mlb', 'nba', 'wnba'] as const) {
      expect(leagueDefaultPhoto(league)).toBeNull();
    }
  });

  it('returns null for a missing league', () => {
    expect(leagueDefaultPhoto(null)).toBeNull();
    expect(leagueDefaultPhoto(undefined)).toBeNull();
  });
});

describe('WNBA seed venue coverage', () => {
  it('every seeded WNBA home venue now resolves to a photo', () => {
    const wnba = PRO_TEAM_SEED.filter(t => t.league === 'wnba' && t.venue_name);
    expect(wnba.length).toBeGreaterThan(0);
    for (const team of wnba) {
      expect(venuePhotoFor(team.venue_name)?.url).toBeTruthy();
    }
  });
});
