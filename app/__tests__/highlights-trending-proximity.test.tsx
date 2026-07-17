/**
 * Regression test for the Trending proximity wiring in app/highlights.tsx.
 *
 * The owner's rule is "Trending should be post nearby them", and
 * server/src/routes/highlights.ts implements that correctly — but only when the
 * client actually sends ?lat/?lng. It didn't: the screen sourced coordinates
 * from `me.preferences.lat` / `me.lat`, and BOTH are dead. `User` has no
 * top-level lat/lng column, and nothing in the codebase ever writes
 * `preferences.lat` (0/46 prod users have it). So no coords went out, the
 * server fell back to zip (null for 39/46 users), got 0 items, and degraded
 * Trending to newest-first — identical to Recent, for ~85% of users.
 *
 * The fix sources real device coordinates via the existing `useDeviceLocation`
 * hook (the same one create-post.tsx uses — one location path, not two).
 */
import { render, waitFor } from '@testing-library/react-native';

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

jest.mock('expo-image', () => require('@/test-utils/screenMocks').expoImageMock());
jest.mock('expo-linear-gradient', () =>
  require('@/test-utils/screenMocks').expoLinearGradientMock()
);
jest.mock('react-native-safe-area-context', () =>
  require('@/test-utils/screenMocks').safeAreaMock()
);
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const mockHighlightsFetch = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Highlights: { fetch: (...args: any[]) => mockHighlightsFetch(...args) },
  Team: { list: jest.fn().mockResolvedValue([]) },
  Event: { filter: jest.fn().mockResolvedValue([]) },
  User: { listAll: jest.fn().mockResolvedValue([]) },
  Organization: { list: jest.fn().mockResolvedValue([]) },
  Search: { unified: jest.fn().mockResolvedValue({}) },
  Post: { toggleUpvote: jest.fn() },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    checkAuth: jest.fn().mockResolvedValue({ id: 'u1', preferences: { country_code: 'US' } }),
  }),
}));
jest.mock('@/context/PostCacheContext', () => ({
  usePostCache: () => ({ setBatch: jest.fn(), get: jest.fn(), set: jest.fn() }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/utils/analytics', () => ({
  analytics: { track: jest.fn() },
  ANALYTICS_EVENTS: { POST_UPVOTED: 'post_upvoted' },
}));

// The dead fields the screen used to read. Present here on purpose: if anyone
// re-adds the `me.preferences.lat` / `me.lat` fallback, these values would leak
// into the request and the assertions below would catch it.
const DEAD_SNAPSHOT = {
  id: 'u1',
  lat: 11.11,
  lng: 22.22,
  preferences: { country_code: 'US', lat: 33.33, lng: 44.44 },
};
jest.mock('@/utils/authState', () => ({
  getAuthSnapshot: jest.fn().mockResolvedValue({
    id: 'u1',
    lat: 11.11,
    lng: 22.22,
    preferences: { country_code: 'US', lat: 33.33, lng: 44.44 },
  }),
}));

let mockLocation: { latitude: number; longitude: number } | null = null;
jest.mock('@/hooks/useDeviceLocation', () => ({
  useDeviceLocation: () => ({
    location: mockLocation,
    loading: false,
    error: null,
    permissionGranted: mockLocation != null,
    accuracyMeters: null,
    isPrecise: true,
    needsPreciseAccuracy: false,
    requestPermission: jest.fn(),
    openSettings: jest.fn(),
    refresh: jest.fn(),
  }),
}));

import HighlightsScreen from '../highlights';
import { QueryWrapper } from '../../test-utils/screenMocks';

const samplePost = {
  id: 'p1',
  title: 'Buzzer beater three',
  caption: 'Buzzer beater three',
  media_url: 'https://example.com/clip.jpg',
  upvotes_count: 4,
  created_at: new Date().toISOString(),
  author_id: 'u2',
  author: { id: 'u2', display_name: 'Alex Hooper', username: 'ahooper' },
  has_upvoted: false,
  has_bookmarked: false,
};

beforeEach(() => {
  mockLocation = null;
  mockHighlightsFetch.mockReset().mockResolvedValue({ sort: 'trending', items: [samplePost] });
});

describe('Highlights Trending proximity wiring', () => {
  it('sends real device lat/lng so the server proximity selection actually runs', async () => {
    mockLocation = { latitude: 40.7128, longitude: -74.006 };
    render(<HighlightsScreen />, { wrapper: QueryWrapper });

    await waitFor(() => expect(mockHighlightsFetch).toHaveBeenCalled());
    const call = mockHighlightsFetch.mock.calls.at(-1)![0];
    expect(call.sort).toBe('trending');
    // Rounded to ~1km so small movements don't churn the query key — the same
    // precision feed.tsx uses for its game-proximity coords.
    expect(call.lat).toBe(40.71);
    expect(call.lng).toBe(-74.01);
  });

  it('never sends the dead me.preferences.lat / me.lat values', async () => {
    mockLocation = { latitude: 40.7128, longitude: -74.006 };
    render(<HighlightsScreen />, { wrapper: QueryWrapper });

    await waitFor(() => expect(mockHighlightsFetch).toHaveBeenCalled());
    const call = mockHighlightsFetch.mock.calls.at(-1)![0];
    expect(call.lat).not.toBe(DEAD_SNAPSHOT.preferences.lat);
    expect(call.lat).not.toBe(DEAD_SNAPSHOT.lat);
    expect(call.lng).not.toBe(DEAD_SNAPSHOT.preferences.lng);
    expect(call.lng).not.toBe(DEAD_SNAPSHOT.lng);
  });

  it('still fetches with no coords when location is denied — never an empty tab', async () => {
    mockLocation = null; // permission denied / unavailable
    render(<HighlightsScreen />, { wrapper: QueryWrapper });

    // The request must still go out so the server's zip → newest-first fallback
    // can serve the tab. Blocking on location would strand the user.
    await waitFor(() => expect(mockHighlightsFetch).toHaveBeenCalled());
    const call = mockHighlightsFetch.mock.calls.at(-1)![0];
    expect(call.sort).toBe('trending');
    expect(call.lat).toBeUndefined();
    expect(call.lng).toBeUndefined();
  });

  it('treats a 0,0 fix as no location rather than Null Island', async () => {
    mockLocation = { latitude: 0, longitude: 0 };
    render(<HighlightsScreen />, { wrapper: QueryWrapper });

    await waitFor(() => expect(mockHighlightsFetch).toHaveBeenCalled());
    const call = mockHighlightsFetch.mock.calls.at(-1)![0];
    expect(call.lat).toBeUndefined();
    expect(call.lng).toBeUndefined();
  });
});
