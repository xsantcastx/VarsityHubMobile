export const EVENT_LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

const parseEventTime = (iso?: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const endOfLocalEventDayMs = (date: Date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
};

export const isCompetitiveEventType = (eventType?: string | null) => {
  if (!eventType) return true;
  return String(eventType).trim().toLowerCase() === 'game';
};

export const isEventPastEndOfDay = (iso?: string | null, nowTs: number = Date.now()) => {
  const date = parseEventTime(iso);
  if (!date) return false;
  return nowTs > endOfLocalEventDayMs(date);
};

export const getEventPresentationPhase = (
  iso?: string | null,
  nowTs: number = Date.now()
): 'upcoming' | 'live' | 'active' | 'final' => {
  const date = parseEventTime(iso);
  if (!date) return 'final';

  const startMs = date.getTime();
  if (nowTs < startMs) return 'upcoming';
  if (nowTs - startMs < EVENT_LIVE_WINDOW_MS) return 'live';
  if (nowTs <= endOfLocalEventDayMs(date)) return 'active';
  return 'final';
};

export const canShowGamePoll = ({
  gameId,
  eventType,
}: {
  gameId?: string | null;
  eventType?: string | null;
}) => {
  if (!gameId) return false;
  if (/^sample-/i.test(String(gameId))) return true;
  return isCompetitiveEventType(eventType);
};
