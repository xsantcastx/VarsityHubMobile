import {
  validateEvent,
  validateEventArray,
  validateEventRsvpArray,
} from '@/api/schemas/event';
import { captureException } from '@/utils/sentry';

jest.mock('@/utils/sentry', () => ({
  captureException: jest.fn(),
}));

const captureExceptionMock = captureException as jest.MockedFunction<typeof captureException>;

// Mirrors the exact shape `serializeEvent` produces on the server (see
// server/src/routes/events.ts). If the serializer adds or renames a
// field, this fixture falls out of date and the drift test below will
// fire through `response_shape_drift` Sentry tagging.
const baseEvent = {
  id: 'evt_1',
  title: 'State Championship',
  date: '2026-05-01T18:00:00.000Z',
  location: 'Centennial Stadium',
  latitude: 35.7796,
  longitude: -78.6382,
  banner_url: null,
  game_id: null,
  capacity: 200,
  status: 'active',
  created_at: '2026-04-20T00:00:00.000Z',
  creator_id: 'user_1',
  creator_role: 'coach',
  approval_status: 'approved',
  event_type: 'game',
  description: null,
  linked_league: null,
  max_attendees: 200,
  contact_info: null,
  approved_at: '2026-04-20T01:00:00.000Z',
  rejected_reason: null,
};

describe('event response schema validation', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it('preserves unknown fields on valid payloads', () => {
    const payload = {
      ...baseEvent,
      extra_hint: 'keep me',
      nested: { enabled: true },
    };

    const result = validateEvent('events.get', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('accepts nested game and creator objects', () => {
    const payload = {
      ...baseEvent,
      game: {
        id: 'game_1',
        title: 'Regional Final',
        cover_image_url: null,
        date: '2026-05-01T18:00:00.000Z',
        location: 'Centennial Stadium',
        home_score: 3,
        away_score: 2,
        winner: 'home',
      },
      creator: {
        id: 'user_1',
        display_name: 'Coach K',
        avatar_url: null,
      },
      attendees_count: 42,
      rsvp_count: 42,
    };

    const result = validateEvent('events.get', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('reports schema drift and fails open on invalid payloads', () => {
    const payload = {
      ...baseEvent,
      // capacity should be number|null — a bool is drift.
      capacity: true,
      server_only_hint: 'keep me',
    };

    const result = validateEvent('events.get', payload);

    expect(result).toBe(payload);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock.mock.calls[0]?.[1]).toMatchObject({
      tags: {
        context: 'response_shape_drift',
        entity: 'event',
        endpoint: 'events.get',
      },
    });
  });

  it('validates event arrays without mutating items', () => {
    const payload = [{ ...baseEvent, adhoc_field: 'present' }];

    const result = validateEventArray('events.filter', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('validates my-rsvps list (rsvp row with nested event)', () => {
    const payload = [
      {
        id: 'rsvp_1',
        created_at: '2026-04-20T12:00:00.000Z',
        event: baseEvent,
      },
      {
        // Event can be null when the underlying event was deleted but the
        // RSVP row still exists — we surface this rather than reject.
        id: 'rsvp_2',
        created_at: '2026-04-20T12:05:00.000Z',
        event: null,
      },
    ];

    const result = validateEventRsvpArray('events.myRsvps', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
