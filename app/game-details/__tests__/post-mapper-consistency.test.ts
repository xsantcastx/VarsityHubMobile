/**
 * Post-mapper Consistency Rule — mechanical enforcement.
 *
 * CLAUDE.md requires the post→FeedPost mappers to stay in sync. The two LIVE
 * mappers are:
 *   - `toFeedPost` in app/profile.tsx               (the /profile + /(tabs)/profile route)
 *   - `mapHighlightToFeedPost` in GameVerticalFeedScreen.tsx (highlights feed)
 *
 * (NOTE: app/features/navigation/screens/ProfileScreen.tsx ALSO contains a
 *  `toFeedPost`, but that screen is orphaned — it is only re-exported by
 *  app/features/navigation/index.ts, which nothing imports. The live profile
 *  route is app/profile.tsx. It is intentionally excluded here; CLAUDE.md's
 *  reference to it is stale.)
 *
 * Until now this rule was prose plus a single caption-chain check. This test
 * asserts the shared, bug-prone fields the rule calls out — caption fallback
 * chain, preview_url, has_upvoted/has_bookmarked shape, media-type resolution —
 * are present and identical across both live mappers, so a fix to one that
 * forgets the other fails CI instead of shipping a context-specific bug.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LIVE_MAPPERS: Array<{ name: string; path: string }> = [
  { name: 'profile.tsx toFeedPost', path: join('app', 'profile.tsx') },
  {
    name: 'GameVerticalFeedScreen mapHighlightToFeedPost',
    path: join('app', 'game-details', 'GameVerticalFeedScreen.tsx'),
  },
];

const sources = LIVE_MAPPERS.map(m => ({
  ...m,
  src: readFileSync(join(process.cwd(), m.path), 'utf8'),
}));

describe('Post-mapper Consistency Rule (live mappers)', () => {
  it.each(sources)('$name includes the caption → content fallback chain', ({ src }) => {
    // Both must fall through `content` so text-only posts render their text.
    expect(src).toContain('item?.caption ?? item?.content');
  });

  it.each(sources)('$name maps preview_url identically', ({ src }) => {
    expect(src).toContain(
      "preview_url: typeof item?.preview_url === 'string' ? item.preview_url : null"
    );
  });

  it.each(sources)('$name coerces has_upvoted / has_bookmarked to booleans', ({ src }) => {
    expect(src).toContain('has_upvoted: Boolean(item?.has_upvoted)');
    expect(src).toContain('has_bookmarked: Boolean(item?.has_bookmarked)');
  });

  it.each(sources)('$name resolves media type via the shared utils/media helper', ({ src }) => {
    expect(src).toContain("from '@/utils/media'");
    expect(src).toContain('resolveMediaType(item?.media_url, item?.media_type)');
  });

  it.each(sources)('$name builds the author shape with id/username/avatar_url', ({ src }) => {
    expect(src).toMatch(/author: item\?\.author/);
    expect(src).toContain('username: item.author.username');
    expect(src).toContain('avatar_url: item.author.avatar_url');
  });
});
