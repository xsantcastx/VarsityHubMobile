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

export interface CalendarDay {
  dateString: string;
  day: string;
  label: string;
  count: number;
}

export interface DiscoverMarkedDate {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
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

function dateKey(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}

export function buildDiscoverMarkedDates(
  games: CalendarRow[],
  events: CalendarRow[],
  selectedDate = '',
  tintColor = '#2563EB'
): Record<string, DiscoverMarkedDate> {
  const marked: Record<string, DiscoverMarkedDate> = {};
  for (const row of [...games, ...events]) {
    const key = dateKey(row.date);
    if (!key) continue;
    marked[key] = {
      ...marked[key],
      marked: true,
      dotColor: tintColor,
    };
  }
  if (selectedDate) {
    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: tintColor,
      selectedTextColor: '#FFFFFF',
    };
  }
  return marked;
}

export function buildUpcomingCalendarDays(
  games: CalendarRow[],
  events: CalendarRow[],
  now: Date = new Date(),
  count = 7
): CalendarDay[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateString = date.toISOString().split('T')[0];
    const eventCount =
      games.filter(game => dateKey(game.date) === dateString).length +
      events.filter(event => dateKey(event.date) === dateString).length;
    return {
      dateString,
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      label: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      count: eventCount,
    };
  });
}
