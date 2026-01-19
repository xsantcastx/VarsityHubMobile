import { render } from '@testing-library/react-native';
import EventMap from '../EventMap';
import type { EventMapProps } from '../EventMap.types';

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, { testID: 'MapView', ...props }, props.children),
    MapView: (props: any) => React.createElement(View, { testID: 'MapView', ...props }, props.children),
    Marker: (props: any) => React.createElement(View, { testID: 'Marker', ...props }, props.children),
    Callout: (props: any) => React.createElement(View, { testID: 'Callout', ...props }, props.children),
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

describe('EventMap', () => {
  it('renders without crashing with events', () => {
    const props: EventMapProps = {
      events: mockEvents,
      onEventPress: jest.fn(),
      initialRegion: {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      },
    };
    const { getByText } = render(<EventMap {...props} />);
    expect(getByText('Test Event')).toBeTruthy();
  });

  it('renders empty state when no events', () => {
    const props: EventMapProps = {
      events: [],
      onEventPress: jest.fn(),
      initialRegion: {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 1,
        longitudeDelta: 1,
      },
    };
    const { getByText } = render(<EventMap {...props} />);
    // Adjust this if you have a specific empty state message
    expect(getByText(/no events/i)).toBeTruthy();
  });

  // Add more tests for user location, marker press, etc.
});
