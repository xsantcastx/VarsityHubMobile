/**
 * PostHog Analytics — centralized event tracking
 *
 * Usage:
 *   import { analytics } from '@/utils/analytics';
 *   analytics.track('post_created', { type: 'text' });
 *   analytics.identify(userId, { role: 'coach', plan: 'veteran' });
 */

import PostHog from 'posthog-react-native';
import { getEnvValue } from '@/config/env';

const POSTHOG_API_KEY = getEnvValue('EXPO_PUBLIC_POSTHOG_API_KEY');
const POSTHOG_HOST = getEnvValue('EXPO_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com');

let posthog: PostHog | null = null;
let analyticsInitialized = false;

export function initAnalytics() {
  if (analyticsInitialized) return;
  if (!POSTHOG_API_KEY) {
    if (__DEV__) console.log('[analytics] PostHog API key not set — analytics disabled');
    return;
  }
  posthog = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    enableSessionReplay: false,
    errorTracking: {
      autocapture: {
        uncaughtExceptions: true,
        unhandledRejections: true,
      },
    },
  });
  analyticsInitialized = true;
}

function normalizeAnalyticsValue(value: unknown): string | number | boolean | string[] {
  if (value == null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => {
      if (item == null) return 'null';
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        return String(item);
      }
      try {
        return JSON.stringify(item);
      } catch {
        return '[unserializable]';
      }
    });
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

export function captureAnalyticsException(
  error: Error | unknown,
  properties?: Record<string, unknown>
) {
  if (!posthog) return;

  const safeProperties = properties
    ? Object.fromEntries(
        Object.entries(properties)
          .filter(([, value]) => typeof value !== 'undefined')
          .map(([key, value]) => [key, normalizeAnalyticsValue(value)])
      )
    : undefined;

  posthog.captureException(error, safeProperties);
}

export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    posthog?.capture(event, properties);
  },

  identify: (userId: string, properties?: Record<string, any>) => {
    posthog?.identify(userId, properties);
  },

  reset: () => {
    posthog?.reset();
  },

  screen: (screenName: string, properties?: Record<string, any>) => {
    posthog?.screen(screenName, properties);
  },
};

// Event name constants for type safety
export const ANALYTICS_EVENTS = {
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  PASSWORD_RESET_CODE_REQUESTED: 'password_reset_code_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  POST_CREATED: 'post_created',
  POST_UPVOTED: 'post_upvoted',
  COMMENT_CREATED: 'comment_created',
  EVENT_PAGE_VIEWED: 'event_page_viewed',
  STORY_ADDED: 'story_added',
  POLL_VOTED: 'poll_voted',
  AD_SUBMITTED: 'ad_submitted',
  AD_PAYMENT_COMPLETED: 'ad_payment_completed',
  COACH_APPROVAL_REQUESTED: 'coach_approval_requested',
  COACH_APPROVED: 'coach_approved',
  GEOFENCE_BLOCKED: 'geofence_blocked',
  SEARCH_PERFORMED: 'search_performed',
  PROFILE_EDITED: 'profile_edited',
} as const;
