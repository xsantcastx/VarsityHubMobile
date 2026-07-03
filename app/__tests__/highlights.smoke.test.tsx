/**
 * Render smoke test for the react-query-migrated Highlights screen
 * (app/highlights.tsx). Verifies the highlights query mounts, the raw
 * nationalTop/ranked buckets map into cards, and a post title renders.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

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
    nationalTop: [samplePost],
    ranked: [],
  });
});

describe('HighlightsScreen (react-query render smoke)', () => {
  it('mounts, runs the highlights query, and renders a highlight card', async () => {
    render(
      <QueryWrapper>
        <HighlightsScreen />
      </QueryWrapper>
    );
    await waitFor(() =>
      expect(mockHighlightsFetch).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'US', limit: 50 })
      )
    );
    expect(await screen.findByText('Buzzer beater three')).toBeTruthy();
  });
});
