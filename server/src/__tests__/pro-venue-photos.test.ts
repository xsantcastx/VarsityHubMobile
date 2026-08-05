import { PRO_TEAM_SEED } from '../lib/proTeams.js';

// Guards the venue_photo_url seed values that back the pro game card's stadium
// preview. A malformed URL here would ship a broken backdrop to every card for
// that franchise (the card's onError fallback catches load failures, but not a
// URL that is syntactically wrong or points off Commons).
describe('pro venue_photo_url seed values', () => {
  const withPhoto = PRO_TEAM_SEED.filter(t => t.venue_photo_url);

  it('seeds stadium photos for MLB franchises (the launch league)', () => {
    const mlbWithPhoto = withPhoto.filter(t => t.league === 'mlb');
    // Not every venue has a good free-use photo yet; the rest fall back to the
    // gradient. Assert we cover the bulk so a regression that drops them is loud.
    expect(mlbWithPhoto.length).toBeGreaterThanOrEqual(20);
  });

  it('only points at Wikimedia Commons Special:FilePath over https', () => {
    for (const t of withPhoto) {
      expect(t.venue_photo_url).toMatch(
        /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//
      );
    }
  });

  it('produces valid URLs with an encoded (never bare) ampersand', () => {
    for (const t of withPhoto) {
      const url = t.venue_photo_url as string;
      // Must parse as a URL.
      expect(() => new URL(url)).not.toThrow();
      // A bare & in the path would split the filename from the query and 404;
      // the encoder must emit %26 instead (e.g. the AT&T Park photo).
      const path = url.split('?')[0];
      expect(path.includes('&')).toBe(false);
    }
  });

  it('requests a bounded width so cards do not pull full-res originals', () => {
    for (const t of withPhoto) {
      expect(t.venue_photo_url).toContain('width=');
    }
  });
});
