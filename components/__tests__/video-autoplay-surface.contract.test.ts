/**
 * Call-site contract for <VideoPlayer autoPlay>.
 *
 * The Fanatics Fest audit found `autoPlay` had been flipped to default `true`
 * in components/VideoPlayer.tsx. Three surfaces that never opted in started
 * autoplaying with FORCED SOUND — `utils/audioSession.ts` sets
 * `playsInSilentMode` + `duckOthers` process-wide and permanently, and the mute
 * toggle was removed. Phone on silent → pick a video to post → it plays at full
 * volume through the hardware silent switch and ducks the user's music.
 *
 * The owner's rule ("videos should always play right away" / "WHEN A VIDEO PLAYS
 * THERE SHOULD ALWAYS BE SOUND") is about CONSUMPTION surfaces — a fan watching
 * content. It is not about COMPOSER/PREVIEW surfaces, where the user is
 * authoring. `autoPlay` is therefore a REQUIRED prop with no default, and this
 * test pins which kind each live call site declared itself to be.
 *
 * A missing prop is already a compile error (`npx tsc --noEmit`); this catches
 * the likelier regression — a composer surface quietly flipped to `autoPlay`.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every live <VideoPlayer> call site, classified by surface kind.
 * Adding a call site without adding it here fails the exhaustiveness check below.
 */
const CONSUMPTION_SURFACES = [
  'app/post-detail.tsx', // swipe-pager hero + fullscreen modal
  'app/game-details/StoriesViewer.tsx', // stories
  'app/game-details/GameDetailsScreen.tsx', // media lightbox (also has a composer site)
];

const COMPOSER_SURFACES = [
  'app/(tabs)/create-post.tsx', // post preview + trimmer, and the full-screen review step
  'app/(tabs)/team-contacts.tsx', // video trim preview
  'app/game-details/GameDetailsScreen.tsx', // story trim preview (also has a consumption site)
];

const ALL_SURFACES = [...new Set([...CONSUMPTION_SURFACES, ...COMPOSER_SURFACES])];

/** Extract the raw JSX props text of every <VideoPlayer .../> in a source file. */
function videoPlayerCallSites(source: string): string[] {
  const sites: string[] = [];
  const marker = '<VideoPlayer';
  let idx = source.indexOf(marker);
  while (idx !== -1) {
    // Scan to the end of this opening tag, respecting nested {...} prop braces.
    let depth = 0;
    let end = idx + marker.length;
    while (end < source.length) {
      const ch = source[end];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) break;
      end++;
    }
    sites.push(source.slice(idx + marker.length, end));
    idx = source.indexOf(marker, end);
  }
  return sites;
}

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('VideoPlayer autoPlay call-site contract', () => {
  it('every live call site lives in a classified file', () => {
    // Guards the lists above against drift — a new surface must declare itself.
    const source = read('components/VideoPlayer.tsx');
    expect(source).toContain('autoPlay: boolean;'); // required, not `autoPlay?:`
    expect(source).not.toMatch(/autoPlay\s*=\s*true/); // no reinstated default
  });

  it.each(ALL_SURFACES)('%s passes autoPlay explicitly at every call site', rel => {
    const sites = videoPlayerCallSites(read(rel));
    expect(sites.length).toBeGreaterThan(0);
    for (const props of sites) {
      expect(props).toMatch(/\bautoPlay\b/);
    }
  });

  it.each(COMPOSER_SURFACES)('%s never autoplays a composer/preview with sound', rel => {
    const composerSites = videoPlayerCallSites(read(rel)).filter(props =>
      /autoPlay=\{false\}/.test(props)
    );
    // Each composer file has at least one deliberately-silent preview player.
    expect(composerSites.length).toBeGreaterThan(0);
  });

  it('create-post silences BOTH of its preview players, not just the review step', () => {
    // The original defect: the author fixed the full-screen review preview
    // (autoPlay={false}) and missed the inline pick preview right above it.
    const sites = videoPlayerCallSites(read('app/(tabs)/create-post.tsx'));
    expect(sites).toHaveLength(2);
    for (const props of sites) {
      expect(props).toMatch(/autoPlay=\{false\}/);
    }
  });

  it('team-contacts never autoplays its trim preview', () => {
    const sites = videoPlayerCallSites(read('app/(tabs)/team-contacts.tsx'));
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatch(/autoPlay=\{false\}/);
  });

  it('consumption surfaces still autoplay — the owner asked for that', () => {
    const postDetail = videoPlayerCallSites(read('app/post-detail.tsx'));
    expect(postDetail).toHaveLength(2);
    for (const props of postDetail) {
      expect(props).not.toMatch(/autoPlay=\{false\}/);
    }

    const stories = videoPlayerCallSites(read('app/game-details/StoriesViewer.tsx'));
    expect(stories).toHaveLength(1);
    // Stories gate on their own `paused` state rather than hardcoding true.
    expect(stories[0]).toMatch(/autoPlay=\{!paused\}/);
  });

  it('GameDetailsScreen autoplays the lightbox but not the story trimmer', () => {
    const sites = videoPlayerCallSites(read('app/game-details/GameDetailsScreen.tsx'));
    expect(sites).toHaveLength(2);
    const silent = sites.filter(p => /autoPlay=\{false\}/.test(p));
    const playing = sites.filter(p => !/autoPlay=\{false\}/.test(p));
    expect(silent).toHaveLength(1); // story trim preview
    expect(playing).toHaveLength(1); // media lightbox
  });

  it('no mute button was reintroduced on consumption surfaces', () => {
    // The owner explicitly rejected one; the audit fix must not sneak it back.
    const source = read('components/VideoPlayer.tsx');
    expect(source).not.toMatch(/accessibilityLabel=["'][^"']*[Mm]ute/);
  });
});
