/**
 * Post-mapper Consistency Rule — mechanical enforcement.
 *
 * CLAUDE.md requires the post→FeedPost mappers to stay in sync. The three LIVE
 * mappers are:
 *   - `toFeedPost` in app/profile.tsx               (the /profile + /(tabs)/profile route)
 *   - `mapHighlightToFeedPost` in GameVerticalFeedScreen.tsx (highlights feed)
 *   - `toFeedPost` in app/team-page.tsx              (the team-page post viewer)
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
  // Third live mapper feeding the same viewer — drifted once (missing
  // game_id/event_id) before it was added here.
  { name: 'team-page.tsx toFeedPost', path: join('app', 'team-page.tsx') },
];

const sources = LIVE_MAPPERS.map(m => ({
  ...m,
  src: readFileSync(join(process.cwd(), m.path), 'utf8'),
}));

describe('Post-mapper Consistency Rule (live mappers)', () => {
  // Pinned to the FULL chain, not just the shared prefix — a prior version of
  // this test used toContain('item?.caption ?? item?.content'), which matches
  // regardless of what the chain falls through to *after* content. That let
  // profile.tsx/team-page.tsx silently drift to a `?? ''` tail (blank caption
  // instead of falling through to the sanitized title) without failing CI.
  it.each(sources)('$name includes the FULL caption fallback chain', ({ src }) => {
    expect(src).toContain('item?.caption ?? item?.content ?? sanitizeTitle(item?.title) ?? null');
  });

  it.each(sources)('$name imports sanitizeTitle from the shared lib', ({ src }) => {
    expect(src).toContain("from '@/lib/sanitizeTitle'");
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

  // Pinned to the FULL author fallback chains — not just the `username:` /
  // `avatar_url:` key prefixes, which matched regardless of what each chain
  // fell through to. profile.tsx/team-page.tsx previously dropped the
  // `user_id` / `display_name` / `avatarUrl` fallbacks, so a highlight-shaped
  // author payload rendered blank on profile/team-page but fine on the
  // highlights feed.
  it.each(sources)('$name builds the author.id with the user_id fallback', ({ src }) => {
    expect(src).toContain('id: String(item.author.id ?? item.author.user_id ?? id)');
  });

  // Owner rule (note 5): identity is username-only. The mappers must NOT fall
  // back to display_name for the username field (that leaked real names as
  // @handles in PostCard). All three must map username with no display_name fallback.
  it.each(sources)('$name maps author.username WITHOUT a display_name fallback', ({ src }) => {
    expect(src).toContain('username: item.author.username ?? null');
    expect(src).not.toContain('item.author.username ?? item.author.display_name');
  });

  it.each(sources)('$name builds the author.avatar_url with the avatarUrl fallback', ({ src }) => {
    expect(src).toContain('avatar_url: item.author.avatar_url ?? item.author.avatarUrl ?? null');
  });

  it.each(sources)('$name carries the event/game linkage (EventChip depends on it)', ({ src }) => {
    expect(src).toContain('game_id: item?.game_id ?? item?.game?.id ?? null');
    expect(src).toContain('event_id: item?.event_id ?? item?.event?.id ?? null');
  });
});
