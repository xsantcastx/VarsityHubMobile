/**
 * Regression: tapping a cluster pin (any state change, really) must NOT
 * re-trigger the "fit all pins" auto-zoom. The auto-fit is a once-per-data-load
 * animation; when it re-fires on unrelated re-renders the map zooms OUT to the
 * continental view every time the user taps something.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const fitToCoordinates = jest.fn();
const animateToRegion = jest.fn();

jest.mock('react-native-maps', () => {
  const ReactActual = require('react');
  const { View, Pressable } = require('react-native');
  const MockMapView = ReactActual.forwardRef((props: any, ref: any) => {
    ReactActual.useImperativeHandle(ref, () => ({
      fitToCoordinates,
      animateToRegion,
    }));
    return <View testID="map-view">{props.children}</View>;
  });
  const MockMarker = (props: any) => (
    <Pressable testID="map-marker" onPress={props.onPress}>
      {props.children}
    </Pressable>
  );
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    PROVIDER_GOOGLE: 'google',
    PROVIDER_DEFAULT: undefined,
  };
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('@/utils/maps', () => ({ getMapProvider: () => undefined }));
jest.mock('@/utils/sentry', () => ({ captureBreadcrumb: jest.fn() }));

import EventMap from '@/components/EventMap';

const EVENTS = [
  // Two events at the SAME venue → one numbered cluster pin ("2")
  {
    id: 'e1',
    title: 'Event 1',
    date: '2026-07-25T00:00:00.000Z',
    latitude: 40.75,
    longitude: -73.99,
    type: 'event' as const,
  },
  {
    id: 'e2',
    title: 'Event 2',
    date: '2026-07-26T00:00:00.000Z',
    latitude: 40.75,
    longitude: -73.99,
    type: 'event' as const,
  },
  {
    id: 'e3',
    title: 'Event 3',
    date: '2026-07-27T00:00:00.000Z',
    latitude: 34.05,
    longitude: -118.24,
    type: 'game' as const,
  },
];

describe('EventMap auto-fit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fitToCoordinates.mockClear();
    animateToRegion.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fits all pins once on load, and does NOT re-fit when a cluster pin is tapped', async () => {
    const screen = render(<EventMap events={EVENTS} dataLoaded showUserLocation />);

    // Flush the location-permission promise, then the 500ms auto-fit timer.
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(fitToCoordinates).toHaveBeenCalledTimes(1);

    // Tap the numbered cluster pin — opens the picker (a state change).
    fireEvent.press(screen.getByText('2'));
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(fitToCoordinates).toHaveBeenCalledTimes(1);

    // Close the picker (another state change) — still no re-fit.
    fireEvent.press(screen.getByText('Event 1'));
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(fitToCoordinates).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-fit to pins when autoFitPins is false (feed map opens USA-wide)', async () => {
    const screen = render(
      <EventMap events={EVENTS} dataLoaded showUserLocation autoFitPins={false} />
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(600);
    });

    // The whole point of the feed map: it must stay on its USA-wide initial
    // region and NOT zoom into whatever pins happened to load.
    expect(fitToCoordinates).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('uses a bounded region for one pin instead of zooming tightly into it', async () => {
    render(<EventMap events={[EVENTS[0]]} dataLoaded showUserLocation />);

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(fitToCoordinates).not.toHaveBeenCalled();
    expect(animateToRegion).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: EVENTS[0].latitude,
        longitude: EVENTS[0].longitude,
        latitudeDelta: 0.35,
        longitudeDelta: 0.35,
      }),
      800
    );
  });
});
