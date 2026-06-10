import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const mockRouterPush = jest.fn();
let capturedFocusEffect: null | (() => void | (() => void)) = null;
let authDeferred: Deferred<any>;
let firstGameDeferred: Deferred<any>;
let gameDeferredQueue: Deferred<any>[] = [];
const mockCheckAuth = jest.fn(() => authDeferred.promise);
const mockGameList = jest.fn(() => {
  const next = gameDeferredQueue.shift();
  if (!next) throw new Error('No queued Game.list response');
  return next.promise;
});

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    capturedFocusEffect = cb;
  },
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/api/entities', () => ({
  Advertisement: {
    forFeed: jest.fn(async () => ({ ads: [] })),
    report: jest.fn(),
  },
  Event: {
    rsvp: jest.fn(),
    rsvpStatus: jest.fn(async () => ({ going: false, count: 0 })),
  },
  Game: {
    list: () => mockGameList(),
    votesSummaryBatch: jest.fn(async () => ({})),
  },
  Feed: {
    bundle: jest.fn(async () => null),
  },
  Highlights: {
    fetch: jest.fn(async () => null),
  },
  Message: {
    unreadCount: jest.fn(async () => ({ count: 0 })),
  },
  Notification: {
    unreadCount: jest.fn(async () => 0),
    listPage: jest.fn(async () => ({ items: [] })),
    markRead: jest.fn(async () => ({})),
  },
  Post: {
    filterPage: jest.fn(async () => ({ items: [] })),
  },
  User: {
    me: jest.fn(),
  },
}));

jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    checkAuth: mockCheckAuth,
  }),
}));

jest.mock('@/components/BannerAd', () => ({
  BannerAd: () => null,
}));

jest.mock('@/components/PostCard', () => () => null);

jest.mock('@/components/ui/SkeletonCard', () => ({
  PostCardSkeleton: () => <View testID="feed-skeleton" />,
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/constants/Colors', () => ({
  Colors: {
    light: {
      text: '#111',
      mutedText: '#666',
      tint: '#0A84FF',
      border: '#ddd',
      background: '#fff',
      card: '#f5f5f5',
    },
    dark: {
      text: '#fff',
      mutedText: '#999',
      tint: '#0A84FF',
      border: '#333',
      background: '#000',
      card: '#111',
    },
  },
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => <>{children}</>,
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => null),
}));

jest.mock('@/utils/imageUrl', () => ({
  optimizeImageUrl: (url: string) => url,
}));

jest.mock('@/utils/notificationPresentation', () => ({
  getNotificationHref: jest.fn(() => '/'),
  getNotificationTitle: jest.fn(() => 'Notification'),
}));

jest.mock('./../app/game-details/GameVerticalFeedScreen', () => () => null);

jest.mock('date-fns', () => ({
  format: () => 'Apr 25',
}));

import FeedScreen from '../app/feed';

describe('Feed startup performance', () => {
  let now = new Date('2026-04-25T12:00:00.000Z').getTime();

  beforeEach(() => {
    jest.clearAllMocks();
    capturedFocusEffect = null;
    authDeferred = createDeferred<any>();
    firstGameDeferred = createDeferred<any>();
    gameDeferredQueue = [firstGameDeferred];
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders game cards before user/background hydration finishes', async () => {
    const screen = render(<FeedScreen />);

    expect(screen.getAllByTestId('feed-skeleton')).toHaveLength(3);

    await act(async () => {
      firstGameDeferred.resolve({
        games: [
          {
            id: 'game-1',
            title: 'Central vs West',
            date: '2026-04-25T18:00:00.000Z',
            location: 'Main Gym',
          },
        ],
        nextCursor: null,
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('feed-game-card-game-1')).toBeTruthy();
    });

    expect(screen.queryByTestId('feed-skeleton')).toBeNull();
    expect(mockCheckAuth).toHaveBeenCalledTimes(1);
    expect(mockGameList).toHaveBeenCalledTimes(1);
  });

  it('keeps existing feed content visible during silent focus refresh', async () => {
    const screen = render(<FeedScreen />);

    await act(async () => {
      firstGameDeferred.resolve({
        games: [
          {
            id: 'game-1',
            title: 'Central vs West',
            date: '2026-04-25T18:00:00.000Z',
            location: 'Main Gym',
          },
        ],
        nextCursor: null,
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('feed-game-card-game-1')).toBeTruthy();
    });

    // Simulate the initial focus: real navigation fires useFocusEffect on
    // first focus, and the screen's hasFocusedOnce gate skips the duplicate
    // load there. Only the SECOND focus (below) should silently refresh.
    await act(async () => {
      const initialFocusCleanup = capturedFocusEffect?.();
      if (typeof initialFocusCleanup === 'function') initialFocusCleanup();
      await Promise.resolve();
    });

    jest.useFakeTimers();
    now += 31_000;
    const secondGamesDeferred = createDeferred<any>();
    gameDeferredQueue.push(secondGamesDeferred);

    let cleanup: unknown;
    await act(async () => {
      cleanup = capturedFocusEffect?.();
      await Promise.resolve();
    });

    expect(mockGameList).toHaveBeenCalledTimes(2);
    expect(mockCheckAuth).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('feed-game-card-game-1')).toBeTruthy();
    expect(screen.queryByTestId('feed-skeleton')).toBeNull();

    if (typeof cleanup === 'function') cleanup();
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    jest.useRealTimers();
  });
});
