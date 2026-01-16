import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import EventMap from '../EventMap';
import type { EventMapProps } from '../EventMap.types';

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
