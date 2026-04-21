import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import EventMap from '../EventMap';
import type { EventMapProps } from '../EventMap.types';

// Mock react-native-maps. The MapView mock forwards the ref and exposes no-op
// implementations of the imperative methods EventMap calls (fitToCoordinates,
// animateToRegion), so ref-based calls don't throw during tests.
jest.mock('react-native-maps', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const MapViewMock = ReactMock.forwardRef((props: any, ref: any) => {
    ReactMock.useImperativeHandle(ref, () => ({
      fitToCoordinates: jest.fn(),
      animateToRegion: jest.fn(),
    }));
    return ReactMock.createElement(View, { testID: 'MapView', ...props }, props.children);
  });
  return {
    __esModule: true,
    default: MapViewMock,
    MapView: MapViewMock,
    Marker: (props: any) => ReactMock.createElement(View, { testID: 'Marker', ...props }, props.children),
  };
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: null,
      accuracy: 10,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  })),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

const mockEvents = [
  {
    id: '1',
    title: 'Test Event',
    latitude: 37.7749,
    longitude: -122.4194,
    date: new Date().toISOString(),
  },
];

const baseRegion = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

// Skip the initial loading-state await by not requesting user location —
// EventMap gates the map render on an async Location call when showUserLocation
// is true, which is the only reason the "Loading map..." view is visible.
const baseProps = (overrides: Partial<EventMapProps> = {}): EventMapProps => ({
  events: mockEvents,
  onEventPress: jest.fn(),
  initialRegion: baseRegion,
  showUserLocation: false,
  ...overrides,
});

describe('EventMap', () => {
  it('renders a Marker for each event with coordinates', async () => {
    const { findAllByTestId } = render(<EventMap {...baseProps()} />);
    const markers = await findAllByTestId('Marker');
    expect(markers.length).toBe(1);
  });

  it('fires onEventPress with event id on single pin tap (no callout step)', async () => {
    const onEventPress = jest.fn();
    const { findByTestId } = render(<EventMap {...baseProps({ onEventPress })} />);
    const marker = await findByTestId('Marker');
    fireEvent.press(marker);
    expect(onEventPress).toHaveBeenCalledWith('1', undefined);
  });

  it('renders empty state when no events', async () => {
    const { findByText } = render(<EventMap {...baseProps({ events: [] })} />);
    const empty = await findByText(/no games with locations yet/i);
    expect(empty).toBeTruthy();
  });
});
