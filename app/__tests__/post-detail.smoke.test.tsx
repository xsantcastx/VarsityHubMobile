/**
 * Render smoke test for the react-query-migrated Post Detail screen
 * (app/post-detail.tsx). Verifies the per-post query mounts after the
 * InteractionManager deferral (settledPostId gate) and the post content +
 * a comment render from the cached payload.
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
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('@/test-utils/screenMocks').reactNavigationOverrides(),
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
  useLocalSearchParams: () => ({ id: 'p1' }),
  // The screen imports useFocusEffect from 'expo-router'; the real one needs a
  // live navigationRef. Route it through useEffect so cleanups still run.
  useFocusEffect: (cb: () => void | (() => void)) => {
    require('react').useEffect(() => cb(), [cb]);
  },
}));
// Heavy media child pulls in expo-video, which can't load under jest.
jest.mock('@/components/VideoPlayer', () =>
  require('@/test-utils/screenMocks').childSentinelMock('VideoPlayer')()
);
jest.mock('@/hooks/useShareLink', () => ({
  useShareLink: () => ({ share: jest.fn() }),
}));
jest.mock('@/hooks/useEdgeSwipeBack', () => ({
  useEdgeSwipeBack: () => ({ edgeSwipeGesture: {} }),
}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
// The screen uses the RNGH v2 API (Gesture.Pinch()...GestureDetector), which
// the global jest.setup mock doesn't cover. Chainable no-op gestures +
// passthrough detector are enough for a render smoke test.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  const makeGesture = (): any =>
    new Proxy(
      {},
      { get: () => () => makeGesture() } // every config call chains a no-op
    );
  return {
    Gesture: new Proxy({}, { get: () => makeGesture }),
    GestureDetector: ({ children }: any) => React.createElement(View, null, children),
    GestureHandlerRootView: ({ children }: any) => React.createElement(View, null, children),
  };
});

const mockPostGet = jest.fn();
const mockPostComments = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Post: {
    get: (...args: any[]) => mockPostGet(...args),
    comments: (...args: any[]) => mockPostComments(...args),
    toggleUpvote: jest.fn(),
    addComment: jest.fn(),
    toggleBookmark: jest.fn(),
    share: jest.fn(),
    delete: jest.fn(),
  },
  Report: { create: jest.fn() },
  User: { follow: jest.fn(), unfollow: jest.fn() },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    checkAuth: jest.fn().mockResolvedValue({ id: 'u1' }),
  }),
}));
jest.mock('@/context/PostCacheContext', () => ({
  usePostCache: () => ({
    get: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    setBatch: jest.fn(),
    remove: jest.fn(),
  }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/utils/authState', () => ({
  ...jest.requireActual('@/utils/authState'),
  getAuthSnapshot: jest.fn().mockResolvedValue({ id: 'u1' }),
}));

import PostDetailScreen from '../post-detail';
import { QueryWrapper } from '../../test-utils/screenMocks';

const samplePost = {
  id: 'p1',
  title: 'Overtime winner',
  caption: 'Overtime winner',
  content: 'What a finish',
  media_url: null,
  upvotes_count: 3,
  comments_count: 1,
  created_at: new Date().toISOString(),
  author_id: 'u2',
  author: { id: 'u2', username: 'coachk', display_name: 'Coach K', avatar_url: null },
  has_upvoted: false,
  has_bookmarked: false,
  is_following_author: false,
};

const sampleComment = {
  id: 'c1',
  content: 'Unreal shot!',
  created_at: new Date().toISOString(),
  user: { id: 'u3', display_name: 'Fan Fran', avatar_url: null },
};

beforeEach(() => {
  mockPostGet.mockReset().mockResolvedValue(samplePost);
  mockPostComments.mockReset().mockResolvedValue({ items: [sampleComment], nextCursor: null });
});

describe('PostDetailScreen (react-query render smoke)', () => {
  it('mounts, fetches the settled post, and renders content + comment', async () => {
    render(
      <QueryWrapper>
        <PostDetailScreen />
      </QueryWrapper>
    );
    // The per-post query is gated on the InteractionManager-settled post id.
    jest.runOnlyPendingTimers();
    await waitFor(() => expect(mockPostGet).toHaveBeenCalledWith('p1'));
    expect(await screen.findByText('What a finish')).toBeTruthy();
    expect(screen.getByText('Unreal shot!')).toBeTruthy();
  });
});
