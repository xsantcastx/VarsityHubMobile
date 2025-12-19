import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { GameDetailsScreen } from '../app/game-details/GameDetailsScreen';
import { useLocationStore } from '../store/locationStore';
import * as geofencingService from '../lib/geofencing';

/**
 * E2E QA Tests for Geofencing UI
 * 
 * Tests that the UI correctly displays posting availability based on:
 * - User location (mocked GPS coordinates)
 * - Event timing (before/during/after event)
 * - Content type (story vs post)
 */

describe('Geofencing UI - QA Automation', () => {
  const mockEventId = 'test-event-123';
  const eventVenueLat = 40.7128;
  const eventVenueLon = -74.006;

  // Test locations at various distances
  const locations = {
    venue: { lat: eventVenueLat, lon: eventVenueLon, name: 'At Venue (0km)' },
    within2km: { 
      lat: eventVenueLat + 0.018, 
      lon: eventVenueLon, 
      name: 'Within 2km (1.8km)' 
    },
    within15km: { 
      lat: eventVenueLat + 0.135, 
      lon: eventVenueLon, 
      name: 'Within 15km (13.5km)' 
    },
    outside15km: { 
      lat: eventVenueLat + 0.27, 
      lon: eventVenueLon, 
      name: 'Outside 15km (27km)' 
    },
  };

  // Mock event times
  const eventTimes = {
    48hBefore: () => new Date(Date.now() - 48 * 60 * 60 * 1000),
    24hBefore: () => new Date(Date.now() - 24 * 60 * 60 * 1000),
    eventTime: () => new Date(),
    24hAfter: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    72hAfter: () => new Date(Date.now() + 72 * 60 * 60 * 1000),
    120hAfter: () => new Date(Date.now() + 120 * 60 * 60 * 1000),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock GPS location
    jest.spyOn(useLocationStore, 'getState').mockReturnValue({
      latitude: locations.venue.lat,
      longitude: locations.venue.lon,
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Story Posting - 2km Radius, Same Day Only', () => {
    it('should allow story when within 2km on event day', async () => {
      useLocationStore.setState({
        latitude: locations.within2km.lat,
        longitude: locations.within2km.lon,
      });

      const { getByTestId } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      const storyButton = getByTestId('story-button');
      expect(storyButton).not.toBeDisabled();
      expect(getByTestId('story-availability')).toHaveTextContent('Available');
    });

    it('should block story when outside 2km radius', async () => {
      useLocationStore.setState({
        latitude: locations.within15km.lat,
        longitude: locations.within15km.lon,
      });

      const { getByTestId, getByText } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      const storyButton = getByTestId('story-button');
      expect(storyButton).toBeDisabled();
      
      fireEvent.press(storyButton);
      await waitFor(() => {
        expect(getByText(/must be within 2km/i)).toBeTruthy();
      });
    });

    it('should block story when outside event calendar day', async () => {
      useLocationStore.setState({
        latitude: locations.within2km.lat,
        longitude: locations.within2km.lon,
      });

      // Mock event 24h in the future
      jest.spyOn(geofencingService, 'getCurrentEventDetails').mockResolvedValue({
        date: eventTimes['24hBefore'](),
      } as any);

      const { getByTestId, getByText } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      const storyButton = getByTestId('story-button');
      expect(storyButton).toBeDisabled();

      fireEvent.press(storyButton);
      await waitFor(() => {
        expect(getByText(/only available on event day/i)).toBeTruthy();
      });
    });

    it('should show countdown when story unavailable', async () => {
      useLocationStore.setState({
        latitude: locations.venue.lat,
        longitude: locations.venue.lon,
      });

      jest.spyOn(geofencingService, 'getCurrentEventDetails').mockResolvedValue({
        date: eventTimes['48hBefore'](),
      } as any);

      const { getByTestId } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      await waitFor(() => {
        const countdown = getByTestId('story-countdown');
        expect(countdown).toHaveTextContent(/hours?.*minutes?/i);
      });
    });
  });

  describe('Event Post Posting - 15km Radius, 120h Window', () => {
    it('should allow post when within 15km during event window', async () => {
      useLocationStore.setState({
        latitude: locations.within15km.lat,
        longitude: locations.within15km.lon,
      });

      const { getByTestId } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      const postButton = getByTestId('post-button');
      expect(postButton).not.toBeDisabled();
      expect(getByTestId('post-availability')).toHaveTextContent('Available');
    });

    it('should block post when outside 15km radius', async () => {
      useLocationStore.setState({
        latitude: locations.outside15km.lat,
        longitude: locations.outside15km.lon,
      });

      const { getByTestId, getByText } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      const postButton = getByTestId('post-button');
      expect(postButton).toBeDisabled();

      fireEvent.press(postButton);
      await waitFor(() => {
        expect(getByText(/must be within 15km/i)).toBeTruthy();
      });
    });

    it('should allow post 48h before event', async () => {
      useLocationStore.setState({
        latitude: locations.within15km.lat,
        longitude: locations.within15km.lon,
      });

      jest.spyOn(geofencingService, 'getCurrentEventDetails').mockResolvedValue({
        date: eventTimes['48hBefore'](),
      } as any);

      const { getByTestId } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      const postButton = getByTestId('post-button');
      expect(postButton).not.toBeDisabled();
    });

    it('should block post outside 120h window', async () => {
      useLocationStore.setState({
        latitude: locations.within15km.lat,
        longitude: locations.within15km.lon,
      });

      jest.spyOn(geofencingService, 'getCurrentEventDetails').mockResolvedValue({
        date: eventTimes['120hAfter'](),
      } as any);

      const { getByTestId, getByText } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      const postButton = getByTestId('post-button');
      expect(postButton).toBeDisabled();

      fireEvent.press(postButton);
      await waitFor(() => {
        expect(getByText(/posting window closed/i)).toBeTruthy();
      });
    });

    it('should block post after event if user did not post during event', async () => {
      useLocationStore.setState({
        latitude: locations.within15km.lat,
        longitude: locations.within15km.lon,
      });

      jest.spyOn(geofencingService, 'getCurrentEventDetails').mockResolvedValue({
        date: eventTimes['24hAfter'](),
      } as any);

      jest.spyOn(geofencingService, 'userPostedDuringEvent').mockResolvedValue(false);

      const { getByTestId, getByText } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      const postButton = getByTestId('post-button');
      expect(postButton).toBeDisabled();

      fireEvent.press(postButton);
      await waitFor(() => {
        expect(getByText(/must have posted during the event/i)).toBeTruthy();
      });
    });

    it('should allow post after event if user posted during event', async () => {
      useLocationStore.setState({
        latitude: locations.within15km.lat,
        longitude: locations.within15km.lon,
      });

      jest.spyOn(geofencingService, 'getCurrentEventDetails').mockResolvedValue({
        date: eventTimes['24hAfter'](),
      } as any);

      jest.spyOn(geofencingService, 'userPostedDuringEvent').mockResolvedValue(true);

      const { getByTestId } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      const postButton = getByTestId('post-button');
      expect(postButton).not.toBeDisabled();
    });
  });

  describe('Button State Transitions', () => {
    it('should show correct disabled state during location updates', async () => {
      const { getByTestId, rerender } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      // Start outside radius
      useLocationStore.setState({
        latitude: locations.outside15km.lat,
        longitude: locations.outside15km.lon,
      });

      rerender(<GameDetailsScreen eventId={mockEventId} />);
      expect(getByTestId('post-button')).toBeDisabled();

      // Move closer to venue
      useLocationStore.setState({
        latitude: locations.within15km.lat,
        longitude: locations.within15km.lon,
      });

      rerender(<GameDetailsScreen eventId={mockEventId} />);
      await waitFor(() => {
        expect(getByTestId('post-button')).not.toBeDisabled();
      });
    });

    it('should update button opacity when disabled', async () => {
      useLocationStore.setState({
        latitude: locations.outside15km.lat,
        longitude: locations.outside15km.lon,
      });

      const { getByTestId } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      const postButton = getByTestId('post-button');
      expect(postButton).toHaveStyle({ opacity: 0.5 });
    });
  });

  describe('Error Messages', () => {
    it('should display distance error message with actual distance', async () => {
      useLocationStore.setState({
        latitude: locations.outside15km.lat,
        longitude: locations.outside15km.lon,
      });

      const { getByTestId, getByText } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      fireEvent.press(getByTestId('post-button'));

      await waitFor(() => {
        const errorText = getByText(/must be within 15km/i);
        expect(errorText).toHaveTextContent(/27.*km/); // Actual distance
      });
    });

    it('should display time window error with exact times', async () => {
      jest.spyOn(geofencingService, 'getCurrentEventDetails').mockResolvedValue({
        date: eventTimes['72hBefore'](),
      } as any);

      const { getByTestId, getByText } = render(
        <GameDetailsScreen eventId={mockEventId} />
      );

      fireEvent.press(getByTestId('post-button'));

      await waitFor(() => {
        const errorText = getByText(/posting opens/i);
        // Should contain formatted date/time
        expect(errorText).toMatch(/\d{1,2}:\d{2}/); // Time pattern
      });
    });
  });
});
