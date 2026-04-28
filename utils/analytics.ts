/**
 * PostHog Analytics — centralized event tracking
 *
 * Usage:
 *   import { analytics } from '@/utils/analytics';
 *   analytics.track('post_created', { type: 'text' });
 *   analytics.identify(userId, { role: 'coach', plan: 'veteran' });
 */

import PostHog from 'posthog-react-native';
import * as env from '@/config/env';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const readAnalyticsEnv = (
  key: 'EXPO_PUBLIC_POSTHOG_API_KEY' | 'EXPO_PUBLIC_POSTHOG_HOST',
  fallback = ''
) => (typeof env.getEnvValue === 'function' ? env.getEnvValue(key, fallback) : fallback);

const POSTHOG_API_KEY = readAnalyticsEnv('EXPO_PUBLIC_POSTHOG_API_KEY');
const POSTHOG_HOST = readAnalyticsEnv('EXPO_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com');
const APP_VERSION = Constants.expoConfig?.version || 'unknown';
const APP_RUNTIME = String(Constants.expoConfig?.runtimeVersion || APP_VERSION);

let posthog: PostHog | null = null;
let analyticsInitialized = false;

function normalizeAnalyticsValue(value: unknown): string | number | boolean | string[] {
  if (value == null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 5).map(item => {
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

function normalizeAnalyticsProperties(
  properties?: Record<string, unknown>
): Record<string, string | number | boolean | string[]> | undefined {
  return properties
    ? Object.fromEntries(
        Object.entries(properties)
          .filter(([, value]) => typeof value !== 'undefined')
          .map(([key, value]) => [key, normalizeAnalyticsValue(value)])
      )
    : undefined;
}

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
  posthog.register({
    service: 'mobile',
    platform: Platform.OS,
    app_version: APP_VERSION,
    app_runtime: APP_RUNTIME,
  });
  analyticsInitialized = true;
}

export function captureAnalyticsException(
  error: Error | unknown,
  properties?: Record<string, unknown>
) {
  if (!posthog) return;

  posthog.captureException(error, normalizeAnalyticsProperties(properties));
}

export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    posthog?.capture(event, properties);
  },

  identify: (userId: string, properties?: Record<string, any>) => {
    if (!posthog) return;
    const safeProperties = normalizeAnalyticsProperties(properties);
    posthog.identify(userId, safeProperties);
    posthog.createPersonProfile();
    if (safeProperties && Object.keys(safeProperties).length > 0) {
      posthog.setPersonProperties(safeProperties, { first_seen_app_version: APP_VERSION }, false);
    }
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
