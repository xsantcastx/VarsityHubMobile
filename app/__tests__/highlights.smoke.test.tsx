/**
 * Render smoke test for the react-query-migrated Highlights screen
 * (app/highlights.tsx). Verifies the per-tab highlights query mounts with
 * the new {sort, items} server shape, tab switches refetch with the right
 * sort/limit, and a legacy {nationalTop, ranked} payload still renders.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

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
const mockSearchUnified = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Highlights: { fetch: (...args: any[]) => mockHighlightsFetch(...args) },
  Team: { list: jest.fn().mockResolvedValue([]) },
  Event: { filter: jest.fn().mockResolvedValue([]) },
  User: { listAll: jest.fn().mockResolvedValue([]) },
  Organization: { list: jest.fn().mockResolvedValue([]) },
  Search: { unified: (...args: any[]) => mockSearchUnified(...args) },
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
jest.mock('@/utils/authState', () => ({
  getAuthSnapshot: jest.fn().mockResolvedValue({ id: 'u1', preferences: { country_code: 'US' } }),
}));
jest.mock('@/utils/analytics', () => ({
  analytics: { track: jest.fn() },
  ANALYTICS_EVENTS: { POST_UPVOTED: 'post_upvoted' },
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
  mockHighlightsFetch.mockReset().mockResolvedValue({
    sort: 'trending',
    items: [samplePost],
  });
  mockSearchUnified.mockReset().mockResolvedValue({
    users: [],
    teams: [],
    organizations: [],
    games: [],
    events: [],
    posts: [],
  });
});

describe('HighlightsScreen (react-query render smoke)', () => {
  it('mounts, fetches the trending tab, and renders a highlight card', async () => {
    render(
      <QueryWrapper>
        <HighlightsScreen />
      </QueryWrapper>
    );
    await waitFor(() =>
      expect(mockHighlightsFetch).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'US', limit: 50, sort: 'trending' })
      )
    );
    expect(await screen.findByText('Buzzer beater three')).toBeTruthy();
  });

  it('switching to the Recent tab fetches sort=recent', async () => {
    render(
      <QueryWrapper>
        <HighlightsScreen />
      </QueryWrapper>
    );
    expect(await screen.findByText('Buzzer beater three')).toBeTruthy();
    fireEvent.press(screen.getByText('🕐 Recent'));
    await waitFor(() =>
      expect(mockHighlightsFetch).toHaveBeenCalledWith(expect.objectContaining({ sort: 'recent' }))
    );
  });

  it('switching to the Top tab fetches sort=top with limit 10', async () => {
    render(
      <QueryWrapper>
        <HighlightsScreen />
      </QueryWrapper>
    );
    expect(await screen.findByText('Buzzer beater three')).toBeTruthy();
    fireEvent.press(screen.getByText('👑 Top'));
    await waitFor(() =>
      expect(mockHighlightsFetch).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'top', limit: 10 })
      )
    );
  });

  it('searches posts via the server instead of filtering the loaded tab list', async () => {
    // Distinct id/title from samplePost, proving this can ONLY have come from
    // the server search call — not from the already-loaded highlights list.
    const searchOnlyPost = {
      id: 'p-search-only',
      title: 'Overtime buzzer beater',
      media_url: 'https://example.com/other-clip.jpg',
      upvotes_count: 1,
      created_at: new Date().toISOString(),
      author_id: 'u3',
      author: { id: 'u3', display_name: 'Jamie Cross', username: 'jcross' },
      has_upvoted: false,
      has_bookmarked: false,
    };
    mockSearchUnified.mockResolvedValue({
      users: [],
      teams: [],
      organizations: [],
      games: [],
      events: [],
      posts: [searchOnlyPost],
    });

    render(
      <QueryWrapper>
        <HighlightsScreen />
      </QueryWrapper>
    );
    expect(await screen.findByText('Buzzer beater three')).toBeTruthy();

    fireEvent.changeText(
      screen.getByPlaceholderText('Search users, teams, or organizations by name or username...'),
      'overtime'
    );
    jest.advanceTimersByTime(300);

    await waitFor(() => expect(mockSearchUnified).toHaveBeenCalledWith('overtime', 10));
    expect(await screen.findByText('Overtime buzzer beater')).toBeTruthy();
  });

  it('still renders cards from a legacy server payload (nationalTop/ranked)', async () => {
    mockHighlightsFetch.mockReset().mockResolvedValue({
      nationalTop: [samplePost],
      ranked: [],
    });
    render(
      <QueryWrapper>
        <HighlightsScreen />
      </QueryWrapper>
    );
    expect(await screen.findByText('Buzzer beater three')).toBeTruthy();
  });
});
