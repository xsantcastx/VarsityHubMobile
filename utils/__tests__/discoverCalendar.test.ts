import { splitCalendarCards } from '../discoverCalendar';
import type { EventCard } from '@/api/schemas/eventCard';

const cards: EventCard[] = [
  {
    id: 'g1',
    source_type: 'game',
    game_id: 'g1',
    event_id: 'e-linked',
    title: 'Game',
    date: '2026-09-10T00:00:00.000Z',
    location: 'Field',
  },
  {
    id: 'e1',
    source_type: 'event',
    game_id: null,
    event_id: 'e1',
    title: 'Event',
    date: '2026-09-11T00:00:00.000Z',
    location: 'Arena',
  },
];

describe('splitCalendarCards', () => {
  it('splits cards into game and event rows by source_type', () => {
    const { games, events } = splitCalendarCards(cards);
    expect(games.map(r => r.id)).toEqual(['g1']);
    expect(events.map(r => r.id)).toEqual(['e1']);
    expect(games[0]).toMatchObject({
      source_type: 'game',
      game_id: 'g1',
      event_id: 'e-linked',
      title: 'Game',
      date: '2026-09-10T00:00:00.000Z',
      location: 'Field',
    });
  });

  it('tolerates an empty or null input', () => {
    expect(splitCalendarCards([])).toEqual({ games: [], events: [] });
    expect(splitCalendarCards(null as any)).toEqual({ games: [], events: [] });
  });
});
