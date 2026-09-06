import React from 'react';
import { act, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { EVENT_BANNER_ASPECT_RATIO } from '@/constants/eventPresentation';

jest.mock('@/api/entities', () => ({ Advertisement: { trackImpression: jest.fn() } }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('expo-image', () => ({ Image: (props: any) => React.createElement('Image', props) }));
import { BannerAd } from '../BannerAd';

it('keeps the event-card frame after an unusually wide ad image loads', () => {
  const screen = render(
    <BannerAd
      bannerUrl="https://example.com/ad.jpg"
      fixedFrame
      aspectRatio={EVENT_BANNER_ASPECT_RATIO}
    />
  );
  const ratio = () => StyleSheet.flatten(screen.getByRole('link').props.style).aspectRatio;
  expect(ratio()).toBe(EVENT_BANNER_ASPECT_RATIO);
  act(() =>
    screen.UNSAFE_getByType('Image' as any).props.onLoad({ source: { width: 2000, height: 400 } })
  );
  expect(ratio()).toBe(EVENT_BANNER_ASPECT_RATIO);
  expect(screen.UNSAFE_getByType('Image' as any).props.contentFit).toBe('contain');
});
