import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'app', 'game-details', 'GameDetailsScreen.tsx'),
  'utf8'
);

describe('GameDetailsScreen highlights route contract', () => {
  it('creates highlights from the game details composer entrypoint', () => {
    expect(source).toContain("params: { gameId: String(targetGameId), type: 'highlight' },");
  });

  it('hydrates the game highlights section from highlight-only posts', () => {
    expect(source).toContain("{ game_id: gameIdValue, type: 'highlight' }");
    expect(source).not.toContain("params: { gameId: String(targetGameId), type: 'post' },");
  });
});
