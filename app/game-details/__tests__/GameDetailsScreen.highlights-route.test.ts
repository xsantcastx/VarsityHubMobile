import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'app', 'game-details', 'GameDetailsScreen.tsx'),
  'utf8'
);

describe('GameDetailsScreen post route contract', () => {
  it('creates normal event posts from the game details Posts action', () => {
    expect(source).toContain("pathname: '/create-post'");
    expect(source).toContain('gameId: String(vm.gameId)');
    expect(source).toContain('eventId: String(vm.eventId)');
    expect(source).toContain("{ eventId: String(vm?.eventId), type: 'post' }");
    expect(source).not.toContain("{ eventId: String(vm?.eventId), type: 'highlight' }");
    expect(source).not.toContain("params: { gameId: String(targetGameId), type: 'highlight' },");
  });

  // REGRESSION GUARD: event pages show all event posts, not just legacy
  // `highlight` rows. A type-filtered query silently hides normal uploads
  // and legacy null-type rows. The game feed must fetch via feedForGame with
  // no type predicate.
  it('hydrates the game feed WITHOUT filtering on post type', () => {
    expect(source).toContain('Post.feedForGame(gameIdValue');
    expect(source).not.toContain("{ game_id: gameIdValue, type: 'highlight' }");
    expect(source).not.toContain("params: { gameId: String(targetGameId), type: 'post' },");
  });
});
