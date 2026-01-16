import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import GameDetailsScreen from '../GameDetailsScreen';
import { Game } from '@/api/entities';

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    Stack: { Screen: () => null },
    useLocalSearchParams: () => ({ id: 'game-1' }),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  };
});

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => {
    const cleanup = cb();
    if (typeof cleanup === 'function') cleanup();
  },
}));

jest.mock('expo-image', () => {
  const React = require('react');
  return { Image: (props: any) => React.createElement('Image', props, props.children) };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return { LinearGradient: (props: any) => React.createElement('LinearGradient', props, props.children) };
});

jest.mock('expo-image-picker', () => ({}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props, props.children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/useDeviceLocation', () => ({
  useDeviceLocation: () => ({
    location: null,
    loading: false,
    error: null,
    permissionGranted: false,
    requestPermission: jest.fn(),
    needsPreciseAccuracy: false,
    openSettings: jest.fn(),
  }),
}));

jest.mock('@/hooks/useShareLink', () => ({
  useShareLink: () => ({ share: jest.fn() }),
}));

jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: () => '#111111',
}));

jest.mock('@/utils/retryWithBackoff', () => ({
  retryWithBackoff: (fn: any) => fn(),
}));

jest.mock('@/api/upload', () => ({ uploadFile: jest.fn() }));

jest.mock('@/components/VideoPlayer', () => {
  const React = require('react');
  return (props: any) => React.createElement('VideoPlayer', props, props.children);
});

jest.mock('../../components/MatchBanner', () => {
  const React = require('react');
  return (props: any) => React.createElement('MatchBanner', props, props.children);
});

jest.mock('../GameVerticalFeedScreen', () => {
  const React = require('react');
  return (props: any) => React.createElement('GameVerticalFeedScreen', props, props.children);
});

jest.mock('@/api/entities', () => ({
  Game: {
    summary: jest.fn(),
    get: jest.fn(),
    posts: jest.fn(),
    media: jest.fn(),
    votesSummary: jest.fn(),
    castVote: jest.fn(),
    clearVote: jest.fn(),
    deleteMedia: jest.fn(),
  },
  Event: {
    rsvp: jest.fn(),
  },
  Team: {
    list: jest.fn(),
  },
  User: {
    me: jest.fn(),
  },
}));

const baseSummary = {
  id: 'game-1',
  gameId: 'game-1',
  title: 'Home vs Away',
  date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  homeTeam: 'Home',
  awayTeam: 'Away',
  teams: [],
  posts: [],
  media: [],
  isPast: false,
};

describe('GameDetailsScreen voting UI', () => {
  beforeEach(() => {
    (Game.summary as jest.Mock).mockResolvedValue(baseSummary);
    (Game.posts as jest.Mock).mockResolvedValue([]);
    (Game.media as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('casts a vote when pressing team A', async () => {
    (Game.votesSummary as jest.Mock).mockResolvedValue({ teamA: 0, teamB: 0, userVote: null });

    const screen = render(<GameDetailsScreen />);
    const voteAButton = await screen.findByLabelText('Vote for Home');

    fireEvent.press(voteAButton);

    await waitFor(() => {
      expect(Game.castVote).toHaveBeenCalledWith('game-1', 'A');
    });
  });

  it('clears a vote on long press when already selected', async () => {
    (Game.votesSummary as jest.Mock).mockResolvedValue({ teamA: 1, teamB: 0, userVote: 'A' });

    const screen = render(<GameDetailsScreen />);
    const voteAButton = await screen.findByLabelText('Vote for Home');

    fireEvent(voteAButton, 'longPress');

    await waitFor(() => {
      expect(Game.clearVote).toHaveBeenCalledWith('game-1');
    });
  });
});
