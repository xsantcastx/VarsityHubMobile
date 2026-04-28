/**
 * PostHog Analytics — centralized event tracking
 *
 * Usage:
 *   import { analytics } from '@/utils/analytics';
 *   analytics.track('post_created', { type: 'text' });
 *   analytics.identify(userId, { role: 'coach', plan: 'veteran' });
 */

import PostHog from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

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
  });
  analyticsInitialized = true;
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
