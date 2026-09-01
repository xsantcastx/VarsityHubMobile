import type { EventCard } from '@/api/schemas/eventCard';

export interface CalendarRow {
  id: string;
  event_id: string | null;
  game_id: string | null;
  source_type: 'game' | 'event';
  title: string;
  date: string | null;
  location: string | null;
}

function toRow(card: EventCard): CalendarRow {
  return {
    id: String(card.id),
    event_id: card.event_id ?? null,
    game_id: card.game_id ?? null,
    source_type: card.source_type,
    title: card.title || (card.source_type === 'game' ? 'Game' : 'Event'),
    date: card.date ?? null,
    location: card.location ?? null,
  };
}

/**
 * Split discovery cards into the game/event rows Discover's calendar renders.
 * The returned rows carry exactly the fields the calendar filters/renders use
 * (id, event_id, game_id, source_type, title, date, location) — so the existing
 * `getSelectedDateGames`/`getSelectedDateEvents` and day-count strip work
 * unchanged when fed from `/event-discovery?scope=following`.
 */
export function splitCalendarCards(cards: EventCard[] | null | undefined): {
  games: CalendarRow[];
  events: CalendarRow[];
} {
  if (!Array.isArray(cards)) return { games: [], events: [] };
  const games: CalendarRow[] = [];
  const events: CalendarRow[] = [];
  for (const card of cards) {
    (card.source_type === 'game' ? games : events).push(toRow(card));
  }
  return { games, events };
}
