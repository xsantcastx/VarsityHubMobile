import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const gamesSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');

describe('game email wiring', () => {
  it('sends linked-event cancellation emails from the live game delete route', () => {
    expect(gamesSrc).toMatch(
      /gamesRouter\.delete\(\s*'\/:id'[\s\S]*?sendEventCanceledEmail\(\{/
    );
  });

  it('cancels linked-event reminders from the live game delete route', () => {
    expect(gamesSrc).toMatch(
      /gamesRouter\.delete\(\s*'\/:id'[\s\S]*?cancelGameReminders\(/
    );
  });

  it('sends linked-event attendee update emails from the live game update route', () => {
    expect(gamesSrc).toMatch(
      /gamesRouter\.put\(\s*'\/:id'[\s\S]*?sendEventUpdatedEmail\(\{/
    );
  });
});
