/**
 * Regression test for caption mapping in GameVerticalFeedScreen.
 *
 * Root cause history:
 *   - mapHighlightToFeedPost used `caption ?? title ?? null`, missing `content`.
 *   - The server returns posts as `{ caption: post.content }` so posts with only
 *     a DB `content` field would work via `item.caption`. But the mapper also
 *     accepted raw highlight/post objects where `content` is the text field and
 *     `caption` may be absent entirely.
 *   - Fix: always include `item?.content` as a fallback in the chain.
 *
 * This test guards both the caption fallback chain AND the text-only post path.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'app', 'game-details', 'GameVerticalFeedScreen.tsx'),
  'utf8'
);

describe('mapHighlightToFeedPost caption mapping', () => {
  it('includes item.content as a fallback in the caption chain', () => {
    // Must fall back through content before title so text-only posts show text
    expect(source).toContain('item?.caption ?? item?.content ?? sanitizeTitle(item?.title)');
  });

  it('does NOT drop content and skip directly to title', () => {
    // This was the original broken pattern — guard against regression
    expect(source).not.toContain('item?.caption ?? sanitizeTitle(item?.title)');
  });
});

describe('GameVerticalFeedScreen text-only post rendering', () => {
  it('renders a text fallback card when media_url is absent', () => {
    // textOnlyCard is the branch rendered when post has no media_url
    expect(source).toContain('styles.textOnlyCard');
    expect(source).toContain('textOnlyCaption');
  });

  it('does not use No content as the sole fallback in the text-only card', () => {
    // The caption should come from post.caption, not a hardcoded fallback alone
    expect(source).toContain("text={post.caption || 'No content'}");
  });
});
