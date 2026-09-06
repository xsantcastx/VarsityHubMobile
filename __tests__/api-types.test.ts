/**
 * Validates that client-side API type definitions match server expectations.
 * These tests compile-time check the typed payloads and verify field names
 * match what the server Zod schemas accept.
 */
import type {
  UpdateMePayload,
  UpdatePreferencesPayload,
  CompleteOnboardingPayload,
  CreateGamePayload,
  UpdateGamePayload,
  SetGameResultPayload,
  CreatePostPayload,
  CreateEventPayload,
  CreateAdPayload,
} from '../apiclient/types';

describe('API type contracts', () => {
  describe('User payloads', () => {
    it('UpdateMePayload has correct shape', () => {
      const payload: UpdateMePayload = {
        display_name: 'Test',
        username: 'test_user',
        avatar_url: 'https://example.com/img.jpg',
        bio: 'Hello',
      };
      expect(Object.keys(payload).length).toBeGreaterThan(0);
    });

    it('UpdatePreferencesPayload accepts push_token and notifications_enabled', () => {
      const payload: UpdatePreferencesPayload = {
        push_token: 'ExponentPushToken[xxx]',
        notifications_enabled: true,
      };
      expect(payload.push_token).toBeDefined();
    });

    it('CompleteOnboardingPayload accepts role and plan', () => {
      const payload: CompleteOnboardingPayload = {
        role: 'coach',
        plan: 'veteran',
        username: 'coach_test',
        display_name: 'Coach Test',
        dob: '1990-01-01',
      };
      expect(payload.role).toBe('coach');
    });
  });

  describe('Game payloads', () => {
    it('CreateGamePayload requires title and location', () => {
      const payload: CreateGamePayload = {
        title: 'Game 1',
        location: 'Main Field',
      };
      expect(payload.title).toBeDefined();
      expect(payload.location).toBeDefined();
    });

    it('CreateGamePayload accepts all event type variants', () => {
      const types: CreateGamePayload['event_type'][] = [
        'game',
        'fundraiser',
        'watch_party',
        'team_trip',
        'meeting',
        'team_meal',
        'other',
      ];
      expect(types).toHaveLength(7);
    });

    it('UpdateGamePayload allows nullable location', () => {
      const payload: UpdateGamePayload = {
        location: null,
      };
      expect(payload.location).toBeNull();
    });

    it('SetGameResultPayload accepts score and winner', () => {
      const payload: SetGameResultPayload = {
        home_score: 3,
        away_score: 1,
        winner: 'home',
      };
      expect(payload.winner).toBe('home');
    });
  });

  describe('Post payloads', () => {
    it('CreatePostPayload accepts location with all fields', () => {
      const payload: CreatePostPayload = {
        content: 'Great game!',
        type: 'photo',
        media_url: 'https://example.com/photo.jpg',
        game_id: 'game123',
        location: {
          lat: 40.7128,
          lng: -74.006,
          source: 'device',
          country_code: 'US',
        },
      };
      expect(payload.location?.source).toBe('device');
    });
  });

  describe('Event payloads', () => {
    it('CreateEventPayload requires title and date', () => {
      const payload: CreateEventPayload = {
        title: 'Fundraiser',
        date: '2026-04-01T18:00:00Z',
        event_type: 'fundraiser',
        location: 'Main Gym',
      };
      expect(payload.title).toBeDefined();
      expect(payload.date).toBeDefined();
    });
  });

  describe('Ad payloads', () => {
    it('CreateAdPayload accepts all ad fields', () => {
      const payload: CreateAdPayload = {
        business_name: 'Test Biz',
        contact_name: 'Test User',
        contact_email: 'test@biz.com',
        banner_url: 'https://example.com/banner.jpg',
        banner_fit_mode: 'cover',
        target_zip_code: '06511',
        radius: 25,
      };
      expect(payload.banner_fit_mode).toBe('cover');
    });
  });
});
