import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'app', 'game-details', 'GameDetailsScreen.tsx'),
  'utf8'
);

describe('GameDetailsScreen highlights route contract', () => {
  it('creates highlights from the game details composer entrypoint', () => {
    expect(source).toContain("pathname: '/create-post'");
    expect(source).toContain('gameId: String(vm.gameId)');
    expect(source).toContain('eventId: String(vm.eventId)');
    expect(source).toContain("{ eventId: String(vm?.eventId), type: 'highlight' }");
    expect(source).not.toContain("params: { gameId: String(targetGameId), type: 'highlight' },");
  });

  // REGRESSION GUARD: TAGGING a post `type: 'highlight'` on creation is fine —
  // it is metadata (asserted above). FILTERING the game feed by that type is not.
  // Normal uploads are tagged `type: 'post'` (create-post.tsx:100 only sends
  // 'highlight' when routed from the add-highlight button) and every legacy post
  // is `type: null` with no backfill. A type-filtered query silently hides both.
  // The game feed must fetch via feedForGame (no type predicate), matching the
  // Highlights surfaces. See api-highlights.test.ts for the server-side guard.
  it('hydrates the game feed WITHOUT filtering on post type', () => {
    expect(source).toContain('Post.feedForGame(gameIdValue');
    expect(source).not.toContain("{ game_id: gameIdValue, type: 'highlight' }");
    expect(source).not.toContain("params: { gameId: String(targetGameId), type: 'post' },");
  });
});
