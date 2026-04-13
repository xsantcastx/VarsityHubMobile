/**
 * PostHog Analytics — centralized event tracking
 *
 * Usage:
 *   import { analytics } from '@/utils/analytics';
 *   analytics.track('post_created', { type: 'text' });
 *   analytics.identify(userId, { role: 'coach', plan: 'veteran' });
 */

import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let posthog: PostHog | null = null;
let logTrackingInstalled = false;
let isCapturingLog = false;
const recentLogTimestamps = new Map<string, number>();
const LOG_DEDUPE_WINDOW_MS = 10_000;
const MAX_LOG_VALUE_LENGTH = 1200;

function truncate(value: string): string {
  return value.length > MAX_LOG_VALUE_LENGTH
    ? `${value.slice(0, MAX_LOG_VALUE_LENGTH)}…`
    : value;
}

function safeSerialize(value: unknown): string {
  if (typeof value === 'string') return truncate(value);
  if (value instanceof Error) {
    return truncate(`${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`);
  }
  try {
    return truncate(JSON.stringify(value));
  } catch {
    return truncate(String(value));
  }
}

function shouldCaptureLog(level: 'warn' | 'error', message: string): boolean {
  if (!posthog || !message.trim()) return false;
  if (message.includes('[analytics]')) return false;
  const dedupeKey = `${level}:${message}`;
  const now = Date.now();
  const lastSeen = recentLogTimestamps.get(dedupeKey) ?? 0;
  if (now - lastSeen < LOG_DEDUPE_WINDOW_MS) {
    return false;
  }
  recentLogTimestamps.set(dedupeKey, now);
  return true;
}

function captureLogEvent(level: 'warn' | 'error', args: unknown[], source: string) {
  const message = truncate(args.map(safeSerialize).join(' '));
  if (!shouldCaptureLog(level, message) || isCapturingLog) return;

  isCapturingLog = true;
  try {
    posthog?.capture('app_log', {
      level,
      source,
      message,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version || 'unknown',
    });
  } finally {
    isCapturingLog = false;
  }
}

export function initAnalytics() {
  if (!POSTHOG_API_KEY) {
    if (__DEV__) console.log('[analytics] PostHog API key not set — analytics disabled');
    return;
  }
  posthog = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    enableSessionReplay: false,
  });
}

export function installPostHogLogTracking() {
  if (!posthog || logTrackingInstalled) return;
  logTrackingInstalled = true;

  const originalConsoleError = console.error.bind(console);
  const originalConsoleWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    captureLogEvent('error', args, 'console.error');
  };

  console.warn = (...args: unknown[]) => {
    originalConsoleWarn(...args);
    captureLogEvent('warn', args, 'console.warn');
  };

  const errorUtils = (globalThis as any).ErrorUtils;
  if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
    const originalGlobalHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      captureLogEvent('error', [error, { isFatal }], 'global');
      originalGlobalHandler?.(error, isFatal);
    });
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('error', (event) => {
      captureLogEvent('error', [event.message, event.error], 'window.error');
    });
    window.addEventListener('unhandledrejection', (event) => {
      captureLogEvent('error', [event.reason], 'window.unhandledrejection');
    });
  }
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

  log: (level: 'warn' | 'error', message: string, properties?: Record<string, any>) => {
    posthog?.capture('app_log', {
      level,
      message: truncate(message),
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version || 'unknown',
      ...properties,
    });
  },
};

// Event name constants for type safety
export const ANALYTICS_EVENTS = {
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
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
