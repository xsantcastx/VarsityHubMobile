/**
 * Web analytics boundary.
 *
 * The native PostHog SDK is not safe to load in the web bundle. This file keeps
 * the browser path web-native and sends a minimal subset of events directly to
 * PostHog's capture API.
 */

import Constants from 'expo-constants';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || '';
const POSTHOG_HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');
const APP_VERSION = Constants.expoConfig?.version || 'unknown';
const LOG_DEDUPE_WINDOW_MS = 10_000;
const MAX_LOG_VALUE_LENGTH = 1200;
const DISTINCT_ID_KEY = 'posthog_distinct_id';

let identifiedUserId: string | null = null;
let logTrackingInstalled = false;
let isCapturingLog = false;
const recentLogTimestamps = new Map<string, number>();

function truncate(value: string): string {
  return value.length > MAX_LOG_VALUE_LENGTH
    ? `${value.slice(0, MAX_LOG_VALUE_LENGTH)}...`
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
  if (!POSTHOG_API_KEY || !message.trim()) return false;
  if (message.includes('[analytics]')) return false;
  const dedupeKey = `${level}:${message}`;
  const now = Date.now();
  const lastSeen = recentLogTimestamps.get(dedupeKey) ?? 0;
  if (now - lastSeen < LOG_DEDUPE_WINDOW_MS) return false;
  recentLogTimestamps.set(dedupeKey, now);
  return true;
}

function getDistinctId(): string {
  if (typeof window === 'undefined') return 'web-server';
  const existing = window.localStorage.getItem(DISTINCT_ID_KEY);
  if (existing) return existing;
  const generated = `web_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  window.localStorage.setItem(DISTINCT_ID_KEY, generated);
  return generated;
}

function sendEvent(event: string, properties: Record<string, unknown> = {}) {
  if (!POSTHOG_API_KEY || typeof fetch !== 'function') return;

  const payload = {
    api_key: POSTHOG_API_KEY,
    event,
    properties: {
      token: POSTHOG_API_KEY,
      distinct_id: identifiedUserId || getDistinctId(),
      platform: 'web',
      app_version: APP_VERSION,
      ...properties,
    },
  };

  void fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

function captureLogEvent(level: 'warn' | 'error', args: unknown[], source: string) {
  const message = truncate(args.map(safeSerialize).join(' '));
  if (!shouldCaptureLog(level, message) || isCapturingLog) return;

  isCapturingLog = true;
  try {
    sendEvent('app_log', { level, source, message });
  } finally {
    isCapturingLog = false;
  }
}

export function initAnalytics() {
  if (!POSTHOG_API_KEY && typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log('[analytics] PostHog API key not set — analytics disabled');
  }
}

export function installPostHogLogTracking() {
  if (logTrackingInstalled) return;
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
    sendEvent(event, properties);
  },

  identify: (userId: string, properties?: Record<string, any>) => {
    identifiedUserId = userId;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISTINCT_ID_KEY, userId);
    }
    sendEvent('$identify', {
      distinct_id: userId,
      $set: properties || {},
    });
  },

  reset: () => {
    identifiedUserId = null;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DISTINCT_ID_KEY);
    }
  },

  screen: (screenName: string, properties?: Record<string, any>) => {
    sendEvent('$screen', { $screen_name: screenName, ...properties });
  },

  log: (level: 'warn' | 'error', message: string, properties?: Record<string, any>) => {
    sendEvent('app_log', {
      level,
      message: truncate(message),
      ...properties,
    });
  },
};

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
