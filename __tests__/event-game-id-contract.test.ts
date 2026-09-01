import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('event/game id contract', () => {
  it('keeps competitive voting keyed to Game.id only', () => {
    const gameDetails = read('app/game-details/GameDetailsScreen.tsx');

    expect(gameDetails).toContain('const voteId = vm?.gameId;');
    expect(gameDetails).not.toContain('const voteId = vm?.gameId || vm?.eventId;');
    expect(gameDetails).toContain('Game.castVote(voteId, team)');
    expect(gameDetails).toContain('Game.clearVote(vm.gameId!)');
  });

  it('refreshes the event page after returning from the upload composer', () => {
    const gameDetails = read('app/game-details/GameDetailsScreen.tsx');

    expect(gameDetails).toContain("import { useFocusEffect } from '@react-navigation/native';");
    expect(gameDetails).toContain('const hasCompletedInitialLoadRef = useRef(false);');
    expect(gameDetails).toContain('void load(true);');
  });

  it('requests device location before event-page uploads start', () => {
    const createPost = read('app/(tabs)/create-post.tsx');
    const gameDetails = read('app/game-details/GameDetailsScreen.tsx');

    expect(createPost).toContain('shouldRequestForSelectedEvent');
    expect(createPost).toContain(
      'const shouldRequestForSelectedEvent = Boolean(gameId) || Boolean(eventId);'
    );
    expect(gameDetails).toContain("'Location Not Ready'");
    expect(gameDetails).toContain('Event stories require current device location within 3 km');
  });

  it('keeps new competitive events out of the event-only create path', () => {
    const eventsRoute = read('server/src/routes/events.ts');

    expect(eventsRoute).toContain("data.event_type === 'game' && !data.game_id");
    expect(eventsRoute).toContain('COMPETITIVE_EVENT_REQUIRES_GAME');
  });
});
