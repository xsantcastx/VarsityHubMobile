import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@/components/CollageView', () => 'CollageView');
jest.mock('@/components/ExpandableText', () => 'ExpandableText');
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: any) => <Text>{name}</Text>,
}));
jest.mock('@/constants/Colors', () => ({
  Colors: {
    light: { background: '#fff', surface: '#fff', text: '#000' },
    dark: { background: '#000', surface: '#000', text: '#fff' },
  },
}));
jest.mock('@/lib/sanitizeTitle', () => ({ sanitizeTitle: (value: any) => value ?? null }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('expo', () => ({ useEventListener: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/utils/navigation', () => ({ safeGoBack: jest.fn() }));
jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), muted: false })),
}));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('@/api/entities', () => ({
  Game: {},
  Highlights: {},
  Post: {},
  Report: {},
  User: {},
}));
jest.mock('@/api/http', () => ({ httpGet: jest.fn() }));
jest.mock('@/utils/events', () => ({ emit: jest.fn() }));
jest.mock('@/utils/links', () => ({ AppLinks: { post: jest.fn() } }));

import { FeedRailNavButtons } from '../GameVerticalFeedScreen';

describe('FeedRailNavButtons', () => {
  it('fires navigation handlers when enabled', () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const { getByTestId } = render(
      <FeedRailNavButtons show canPrev canNext onPrev={onPrev} onNext={onNext} />
    );

    fireEvent.press(getByTestId('highlights-nav-up'));
    fireEvent.press(getByTestId('highlights-nav-down'));

    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('respects disabled boundary states', () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const { getByTestId, rerender } = render(
      <FeedRailNavButtons show canPrev={false} canNext onPrev={onPrev} onNext={onNext} />
    );

    const upButton = getByTestId('highlights-nav-up');
    const downButton = getByTestId('highlights-nav-down');

    expect(upButton.props.accessibilityState).toEqual({ disabled: true });
    expect(downButton.props.accessibilityState).toEqual({ disabled: false });
    fireEvent.press(upButton);
    fireEvent.press(downButton);
    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledTimes(1);

    rerender(
      <FeedRailNavButtons show canPrev canNext={false} onPrev={onPrev} onNext={onNext} />
    );

    const nextDownButton = getByTestId('highlights-nav-down');
    expect(nextDownButton.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(nextDownButton);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('does not render when there is only one post', () => {
    const { queryByTestId } = render(
      <FeedRailNavButtons
        show={false}
        canPrev={false}
        canNext={false}
        onPrev={jest.fn()}
        onNext={jest.fn()}
      />
    );

    expect(queryByTestId('highlights-nav-up')).toBeNull();
    expect(queryByTestId('highlights-nav-down')).toBeNull();
  });
});
