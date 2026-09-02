import { readFileSync } from 'fs';
import { join } from 'path';

const gameMapSource = readFileSync(join(process.cwd(), 'app', 'game-map.tsx'), 'utf8');
const eventMapTypesSource = readFileSync(
  join(process.cwd(), 'components', 'EventMap.types.ts'),
  'utf8'
);

describe('game map create-post contract', () => {
  it('keeps event/game upload target ids on map markers', () => {
    expect(eventMapTypesSource).toContain('event_id?: string | null');
    expect(eventMapTypesSource).toContain('game_id?: string | null');
    expect(eventMapTypesSource).toContain('onCreatePostPress?: (event: EventMapData) => void');
  });

  it('routes the selected map marker to create-post with game/event ids', () => {
    expect(gameMapSource).toContain('const handleCreatePostPress = useCallback');
    expect(gameMapSource).toContain("pathname: '/create-post'");
    expect(gameMapSource).toContain('...(gameId ? { gameId } : {})');
    expect(gameMapSource).toContain('...(eventId ? { eventId } : {})');
    expect(gameMapSource).toContain('onCreatePostPress={handleCreatePostPress}');
  });
});
