jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: any) => React.createElement(View, { ...props, testID: 'banner-image' }),
  };
});

jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn(async () => true),
  openURL: jest.fn(async () => undefined),
}));

jest.mock('@/api/entities', () => ({
  Advertisement: {
    trackImpression: jest.fn(async () => ({ ok: true })),
    trackClick: jest.fn(async () => ({ ok: true })),
  },
}));

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { Advertisement } from '@/api/entities';
import { BannerAd } from '@/components/BannerAd';
import * as Linking from 'expo-linking';

describe('BannerAd engagement tracking', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('tracks a single impression when a real feed ad mounts', async () => {
    render(
      <BannerAd
        adId="ad_metrics_123"
        bannerUrl="https://example.com/banner.jpg"
        targetUrl="example.com"
        businessName="Metrics Hardware"
      />
    );

    await waitFor(() => {
      expect(Advertisement.trackImpression).toHaveBeenCalledWith('ad_metrics_123');
    });
    expect(Advertisement.trackImpression).toHaveBeenCalledTimes(1);
  });

  it('tracks click only when the user confirms the external open action', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const screen = render(
      <BannerAd
        adId="ad_metrics_123"
        bannerUrl="https://example.com/banner.jpg"
        targetUrl="example.com"
        businessName="Metrics Hardware"
      />
    );

    fireEvent.press(screen.getByLabelText('Sponsored advertisement'));

    expect(alertSpy).toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0]?.[2] || [];
    const openButton = buttons.find((button: any) => button?.text === 'Open');
    expect(openButton).toBeTruthy();
    if (!openButton?.onPress) {
      throw new Error('Expected Open button with onPress handler');
    }

    await openButton.onPress();

    await waitFor(() => {
      expect(Advertisement.trackClick).toHaveBeenCalledWith('ad_metrics_123');
    });
    expect(Linking.canOpenURL).toHaveBeenCalledWith('https://example.com');
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');

    alertSpy.mockRestore();
  });
});
