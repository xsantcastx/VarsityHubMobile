import Constants from 'expo-constants';
import { Platform } from 'react-native';

type EnvKey =
  | 'EXPO_PUBLIC_API_URL'
  | 'EXPO_PUBLIC_USE_LOCAL_API'
  | 'EXPO_PUBLIC_FORCE_REMOTE_API'
  | 'EXPO_PUBLIC_NODE_ENV'
  | 'EXPO_PUBLIC_APP_SCHEME'
  | 'EXPO_PUBLIC_WEB_BASE_URL'
  | 'EXPO_PUBLIC_APP_BASE_URL'
  | 'EXPO_PUBLIC_SENTRY_DSN'
  | 'EXPO_PUBLIC_POSTHOG_API_KEY'
  | 'EXPO_PUBLIC_POSTHOG_HOST'
  | 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  | 'EXPO_PUBLIC_ADMIN_EMAILS'
  | 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'
  | 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
  | 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'
  | 'EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID'
  | 'EXPO_PUBLIC_GOOGLE_FORCE_PROXY'
  | 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'
  | 'EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME';

type RawEnv = Partial<Record<EnvKey, string | undefined>>;

const expoConfigExtra = ((Constants?.expoConfig as any)?.extra ?? {}) as Record<string, any>;
const processEnv: RawEnv =
  (typeof process !== 'undefined' ? ((process as any).env as RawEnv | undefined) : undefined) ?? {};

const DEFAULT_API_URL = 'https://api-production-8ac3.up.railway.app';
const DEFAULT_WEB_BASE = 'https://varsityhub.app';
const CANONICAL_GOOGLE_CLIENT_IDS = {
  android: '514463516787-bhvkja2devf8mrk204pcti7nld90d2g9.apps.googleusercontent.com',
  ios: '514463516787-dm665i3u3a6un7eties8q73eik17vcs3.apps.googleusercontent.com',
  web: '514463516787-rqdc3es1n5ofr3v7dn1l1gpj6r8kauqu.apps.googleusercontent.com',
  expo: '514463516787-rqdc3es1n5ofr3v7dn1l1gpj6r8kauqu.apps.googleusercontent.com',
} as const;
const DELETED_GOOGLE_CLIENT_PREFIXES = ['316424'];

const normalizeUrl = (value: string) => value.replace(/\/$/, '');

function isDeletedGoogleClientId(value: string): boolean {
  return DELETED_GOOGLE_CLIENT_PREFIXES.some(prefix => value.startsWith(prefix));
}

function normalizeGoogleClientId(
  value: string | undefined,
  fallback: (typeof CANONICAL_GOOGLE_CLIENT_IDS)[keyof typeof CANONICAL_GOOGLE_CLIENT_IDS]
): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (isDeletedGoogleClientId(trimmed)) {
    if (__DEV__) {
      console.warn('[env] Replacing deleted Google OAuth client ID from runtime config:', trimmed);
    }
    return fallback;
  }
  return trimmed;
}

function getDevLocalApiUrl(): string {
  if (typeof window === 'undefined') {
    return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
  }
  const host = window.location.hostname;
  if (host === '127.0.0.1') return 'http://127.0.0.1:4000';
  if (host === 'localhost') return 'http://localhost:4000';
  return `http://${host}:4000`;
}

function readEnv(key: EnvKey, fallback?: string): string {
  const raw = processEnv[key] ?? (expoConfigExtra[key] as string | undefined);
  if (raw === undefined || raw === null || raw === '') {
    return fallback ?? '';
  }
  return String(raw);
}

function readBoolean(key: EnvKey, fallback: boolean): boolean {
  const raw = readEnv(key);
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export type AppConfig = {
  apiUrl: string;
  forceRemoteApi: boolean;
  nodeEnv: string;
  appScheme: string;
  webBaseUrl: string;
  sentryDsn: string;
  stripePublishableKey: string;
  adminEmails: string[];
  expoProjectFullName?: string;
  google: {
    androidClientId?: string;
    iosClientId?: string;
    webClientId?: string;
    expoClientId?: string;
    forceProxy: boolean;
  };
  mapsKey?: string;
};

const config: AppConfig = {
  apiUrl: (() => {
    const envUrl = readEnv('EXPO_PUBLIC_API_URL');
    const useLocalApi = readBoolean('EXPO_PUBLIC_USE_LOCAL_API', false);
    const forceRemoteApi = readBoolean('EXPO_PUBLIC_FORCE_REMOTE_API', true);
    const normalizedEnvUrl = envUrl ? normalizeUrl(envUrl) : '';

    if (__DEV__ && useLocalApi) {
      return getDevLocalApiUrl();
    }

    if (normalizedEnvUrl) {
      const isLocalhostEnv = /localhost|127\.0\.0\.1/.test(normalizedEnvUrl);
      // A localhost API URL must never be honored in a production build, even
      // if EXPO_PUBLIC_FORCE_REMOTE_API is disabled via a stale .env.
      if (!isLocalhostEnv || __DEV__) {
        return normalizedEnvUrl;
      }
    }

    if (__DEV__ && !forceRemoteApi) {
      return getDevLocalApiUrl();
    }

    return DEFAULT_API_URL;
  })(),
  forceRemoteApi: readBoolean('EXPO_PUBLIC_FORCE_REMOTE_API', true),
  nodeEnv: readEnv('EXPO_PUBLIC_NODE_ENV', __DEV__ ? 'development' : 'production'),
  appScheme: readEnv('EXPO_PUBLIC_APP_SCHEME', 'varsityhubmobile') || 'varsityhubmobile',
  webBaseUrl:
    normalizeUrl(
      readEnv('EXPO_PUBLIC_WEB_BASE_URL') || readEnv('EXPO_PUBLIC_APP_BASE_URL') || DEFAULT_WEB_BASE
    ) || DEFAULT_WEB_BASE,
  sentryDsn: readEnv('EXPO_PUBLIC_SENTRY_DSN'),
  stripePublishableKey: readEnv('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  adminEmails: (readEnv('EXPO_PUBLIC_ADMIN_EMAILS') || '')
    .split(',')
    .map(email => email.trim())
    .filter(Boolean),
  expoProjectFullName: readEnv('EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME') || undefined,
  google: {
    androidClientId: normalizeGoogleClientId(
      readEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
      CANONICAL_GOOGLE_CLIENT_IDS.android
    ),
    iosClientId: normalizeGoogleClientId(
      readEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
      CANONICAL_GOOGLE_CLIENT_IDS.ios
    ),
    webClientId: normalizeGoogleClientId(
      readEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
      CANONICAL_GOOGLE_CLIENT_IDS.web
    ),
    expoClientId: normalizeGoogleClientId(
      readEnv('EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID'),
      CANONICAL_GOOGLE_CLIENT_IDS.expo
    ),
    forceProxy: readBoolean('EXPO_PUBLIC_GOOGLE_FORCE_PROXY', false),
  },
  mapsKey: readEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY') || undefined,
};

export const getConfig = (): AppConfig => config;
export const getEnvValue = (key: EnvKey, fallback = ''): string => readEnv(key, fallback);
export const __internal = {
  normalizeGoogleClientId,
  isDeletedGoogleClientId,
  CANONICAL_GOOGLE_CLIENT_IDS,
};
