/**
 * Regression tests for the bug-PDF fixes.
 *
 * Source-grep style — same approach as
 * server/src/__tests__/requireOnboarded-upload-bypass.test.ts. These pin
 * the exact lines that fixed two reported issues so a future refactor
 * can't silently undo them.
 *
 * Issue #6 — `?` glyphs on PostCard stat pills (iOS).
 *   Root layout must explicitly load MaterialIcons + Ionicons fonts via
 *   `useFonts`. Without this, certain glyphs render as the `?` fallback
 *   on iOS at small sizes.
 *
 * Issue #14 — Past-event detail page stuck on "No highlights yet" even
 * when the game has posts. The deferred posts/media fetches in
 * GameDetailsScreen used to silently swallow errors with maxRetries: 0,
 * so a single network blip zeroed out the posts array forever.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const rootLayoutSrc = readFileSync(join(process.cwd(), 'app', '_layout.tsx'), 'utf8');

const gameDetailsSrc = readFileSync(
  join(process.cwd(), 'app', 'game-details', 'GameDetailsScreen.tsx'),
  'utf8'
);

describe('PDF bug-fix regression — #6 icon fonts loaded in root layout', () => {
  it('imports MaterialIcons + Ionicons from @expo/vector-icons', () => {
    expect(rootLayoutSrc).toMatch(
      /import\s+\{[^}]*\b(?:MaterialIcons|Ionicons)\b[^}]*\}\s+from\s+'@expo\/vector-icons'/
    );
    expect(rootLayoutSrc).toMatch(/MaterialIcons/);
    expect(rootLayoutSrc).toMatch(/Ionicons/);
  });

  it('spreads the icon-font assets into useFonts', () => {
    // Match the exact useFonts call and assert both font spreads exist
    // inside it. Using a single multi-line regex keeps the assertion tied
    // to the call site — a stray `MaterialIcons.font` reference elsewhere
    // would not satisfy this.
    const useFontsBlock = rootLayoutSrc.match(/useFonts\(\{[\s\S]*?\}\)/);
    expect(useFontsBlock).not.toBeNull();
    expect(useFontsBlock![0]).toMatch(/\.\.\.MaterialIcons\.font/);
    expect(useFontsBlock![0]).toMatch(/\.\.\.Ionicons\.font/);
  });
});

describe('PDF bug-fix regression — #14 game-details deferred fetch retries', () => {
  it('retries Post.feedForGame at least once', () => {
    // The deferred posts fetch must wrap Post.feedForGame in retryWithBackoff
    // with maxRetries > 0. Scope to the full retryWithBackoff(...).catch
    // statement so the `maxRetries:` we read belongs to the options object
    // for THIS call (not a different retryWithBackoff in the same file).
    const postsRetryBlock = gameDetailsSrc.match(
      /retryWithBackoff\(\s*\(\s*\)\s*=>\s*Post\.feedForGame[\s\S]*?\}\s*\)\s*\.catch/
    );
    expect(postsRetryBlock).not.toBeNull();
    const maxRetriesMatch = postsRetryBlock![0].match(/maxRetries:\s*(\d+)/);
    expect(maxRetriesMatch).not.toBeNull();
    expect(Number(maxRetriesMatch![1])).toBeGreaterThan(0);
  });

  it('retries Game.media at least once', () => {
    const mediaRetryBlock = gameDetailsSrc.match(
      /retryWithBackoff\(\s*\(\s*\)\s*=>\s*Game\.media[\s\S]*?\}\s*\)\s*\.catch/
    );
    expect(mediaRetryBlock).not.toBeNull();
    const maxRetriesMatch = mediaRetryBlock![0].match(/maxRetries:\s*(\d+)/);
    expect(maxRetriesMatch).not.toBeNull();
    expect(Number(maxRetriesMatch![1])).toBeGreaterThan(0);
  });

  it('logs deferred posts/media failures instead of silently swallowing', () => {
    // Previously: `.catch(() => null)` — no logging, no breadcrumb.
    // Current: a dev-warn marker is present in both catch handlers. If a
    // future change strips the logging, this test fails so the regression
    // is caught before it ships.
    expect(gameDetailsSrc).toMatch(/\[GameDetails\] deferred posts fetch failed/);
    expect(gameDetailsSrc).toMatch(/\[GameDetails\] deferred media fetch failed/);
  });
});
