import Constants from 'expo-constants';

type EnvKey =
  | 'EXPO_PUBLIC_API_URL'
  | 'EXPO_PUBLIC_FORCE_REMOTE_API'
  | 'EXPO_PUBLIC_NODE_ENV'
  | 'EXPO_PUBLIC_APP_SCHEME'
  | 'EXPO_PUBLIC_WEB_BASE_URL'
  | 'EXPO_PUBLIC_APP_BASE_URL'
  | 'EXPO_PUBLIC_SENTRY_DSN'
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

const normalizeUrl = (value: string) => value.replace(/\/$/, '');

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
  apiUrl: normalizeUrl(readEnv('EXPO_PUBLIC_API_URL', DEFAULT_API_URL) || DEFAULT_API_URL),
  forceRemoteApi: readBoolean('EXPO_PUBLIC_FORCE_REMOTE_API', true),
  nodeEnv: readEnv('EXPO_PUBLIC_NODE_ENV', __DEV__ ? 'development' : 'production'),
  appScheme: readEnv('EXPO_PUBLIC_APP_SCHEME', 'varsityhubmobile') || 'varsityhubmobile',
  webBaseUrl:
    normalizeUrl(
      readEnv('EXPO_PUBLIC_WEB_BASE_URL') ||
        readEnv('EXPO_PUBLIC_APP_BASE_URL') ||
        DEFAULT_WEB_BASE
    ) || DEFAULT_WEB_BASE,
  sentryDsn: readEnv('EXPO_PUBLIC_SENTRY_DSN'),
  stripePublishableKey: readEnv('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  adminEmails: (readEnv('EXPO_PUBLIC_ADMIN_EMAILS') || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean),
  expoProjectFullName: readEnv('EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME') || undefined,
  google: {
    androidClientId: readEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID') || undefined,
    iosClientId: readEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') || undefined,
    webClientId: readEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') || undefined,
    expoClientId: readEnv('EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID') || undefined,
    forceProxy: readBoolean('EXPO_PUBLIC_GOOGLE_FORCE_PROXY', false),
  },
  mapsKey: readEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY') || undefined,
};

export const getConfig = (): AppConfig => config;
export const getEnvValue = (key: EnvKey, fallback = ''): string => readEnv(key, fallback);
