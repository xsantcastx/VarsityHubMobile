import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'app', 'game-details', 'GameVerticalFeedScreen.tsx'),
  'utf8'
);

describe('GameVerticalFeedScreen rail actions', () => {
  it('removes the rail nav toggle and standalone share button', () => {
    expect(source).not.toContain('highlights-nav-up');
    expect(source).not.toContain('highlights-nav-down');
    expect(source).not.toContain('FeedRailNavButtons');
    expect(source).not.toContain('<Text style={styles.railLabel}>Share</Text>');
  });

  it('keeps the action rail focused on avatar, upvote, comments, bookmark, and options', () => {
    expect(source).toContain("name={post.has_upvoted ? 'arrow-up' : 'arrow-up-outline'}");
    expect(source).toContain('chatbubble-ellipses-outline');
    expect(source).toContain("name={post.has_bookmarked ? 'bookmark' : 'bookmark-outline'}");
    expect(source).toContain('<Text style={styles.railLabel}>Options</Text>');
  });

  it('moves share into the combined options menu', () => {
    expect(source).toContain('Share Post');
    expect(source).toContain('Copy Link');
    expect(source).toContain('Report Post');
    expect(source).toMatch(/setShowOptionsMenu\(false\);\s*onSharePost\(\);/);
  });
});
