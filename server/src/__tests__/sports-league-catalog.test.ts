import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SPORTS_LEAGUE_CATALOG } from '../lib/sportsLeagueCatalog.js';

const sportsTaxonomy = JSON.parse(
  readFileSync(path.join(process.cwd(), '../shared/sports-taxonomy.json'), 'utf8')
) as { sports: Array<{ slug: string }> };

describe('sports league catalog', () => {
  const slugs = SPORTS_LEAGUE_CATALOG.map(league => league.slug);
  const taxonomySlugs = new Set(sportsTaxonomy.sports.map(sport => sport.slug));

  it('has unique, safe slugs and ids', () => {
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(SPORTS_LEAGUE_CATALOG.map(league => league.id)).size).toBe(
      SPORTS_LEAGUE_CATALOG.length
    );
    for (const league of SPORTS_LEAGUE_CATALOG) {
      expect(league.slug).toMatch(/^[a-z0-9_]+$/);
      expect(league.id).toBe(`sports_league_${league.slug}`);
      expect(league.active).toBe(true);
    }
  });

  it('covers major, minor, and NCAA league categories', () => {
    expect(slugs).toEqual(
      expect.arrayContaining([
        'nfl',
        'nba',
        'wnba',
        'mlb',
        'nhl',
        'mls',
        'nwsl',
        'wwe',
        'ufc',
        'milb_triple_a',
        'milb_double_a',
        'milb_high_a',
        'milb_single_a',
        'ahl',
        'echl',
        'nba_g_league',
        'usl_championship',
        'usl_league_one',
        'ncaaf',
        'ncaamb',
        'ncaawb',
        'ncaabaseball',
        'ncaasoftball',
        'ncaamhockey',
        'ncaawhockey',
        'ncaamsoccer',
        'ncaawsoccer',
        'ncaawvolleyball',
        'ncaawbeach_volleyball',
        'ncaafencing',
        'ncaarifle',
        'ncaaskiing',
        'ncaawrowing',
        'ncaawstunt',
      ])
    );
    expect(SPORTS_LEAGUE_CATALOG.some(league => league.level === 'major')).toBe(true);
    expect(SPORTS_LEAGUE_CATALOG.some(league => league.level === 'minor')).toBe(true);
    expect(SPORTS_LEAGUE_CATALOG.some(league => league.level === 'college')).toBe(true);
  });

  it('uses sports that the map can normalize and filter', () => {
    for (const league of SPORTS_LEAGUE_CATALOG) {
      expect(taxonomySlugs.has(league.sport_slug)).toBe(true);
    }
  });
});
