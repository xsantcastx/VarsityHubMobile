import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const gameDetailsSource = readFileSync(
  join(process.cwd(), 'app', 'game-details', 'GameDetailsScreen.tsx'),
  'utf8'
);

describe('story video platform foundation', () => {
  it('uses the same web fallback in game story uploads', () => {
    expect(gameDetailsSource).toContain(
      'const canTrimStoryVideo = isNativeVideoTrimSupported(Platform.OS);'
    );
    expect(gameDetailsSource).toContain('Web uploads the selected video as-is.');
  });
});
