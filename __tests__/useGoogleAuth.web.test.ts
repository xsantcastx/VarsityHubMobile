/**
 * useGoogleAuth — web responseType unit tests
 *
 * Bug: on web, Google.useAuthRequest defaults to the implicit
 * ResponseType.Token flow (expo-auth-session providers/Google.js), which
 * returns only an access_token. The hook needs an id_token for
 * POST /auth/google, so web sign-in could never succeed:
 *   - Path 1 (response.authentication?.idToken) was always empty
 *   - Path 2 (code exchange) never ran — no code in an implicit response
 *
 * Fix: pass responseType: ResponseType.IdToken when Platform.OS === 'web'.
 * The provider auto-adds the required nonce, and TokenResponse maps
 * id_token → authentication.idToken, so Path 1 works unchanged.
 *
 * The native paths must NOT get a responseType override — iOS relies on the
 * provider's default code flow (WORKING — DO NOT MODIFY).
 */

import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

// ─── Mocks (same pattern as useGoogleAuth.proxy.test.ts) ────────────────────

const mockConstantsData = {
  executionEnvironment: 'standalone' as string | null,
  appOwnership: null as string | null,
  expoConfig: {
    slug: 'varsityhub',
    owner: 'varsity-hub',
    extra: {},
  },
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: mockConstantsData,
}));

jest.mock('@/config/env', () => {
  const actual = jest.requireActual('@/config/env');
  return {
    ...actual,
    getConfig: () => ({
      apiUrl: 'https://api-production-8ac3.up.railway.app',
      forceRemoteApi: true,
      nodeEnv: 'production',
      appScheme: 'varsityhubmobile',
      webBaseUrl: 'https://varsityhub.app',
      sentryDsn: '',
      stripePublishableKey: '',
      adminEmails: [],
      expoProjectFullName: '@varsity-hub/varsityhub',
      google: {
        androidClientId: '814866365020-d7dk3k9gf49jodhnbraps8p7l9jrfs10.apps.googleusercontent.com',
        iosClientId: '814866365020-ia09lnm6he2prvaivrp8sblh7oeh9ic0.apps.googleusercontent.com',
        webClientId: '514463516787-rqdc3es1n5ofr3v7dn1l1gpj6r8kauqu.apps.googleusercontent.com',
        expoClientId: '514463516787-rqdc3es1n5ofr3v7dn1l1gpj6r8kauqu.apps.googleusercontent.com',
        forceProxy: false,
      },
      mapsKey: undefined,
    }),
  };
});

jest.mock('expo-auth-session', () => ({
  __esModule: true,
  makeRedirectUri: (opts?: { native?: string; scheme?: string }) =>
    opts?.native ?? opts?.scheme ?? 'varsityhubmobile://oauthredirect',
  getRedirectUrl: () => 'https://auth.expo.io/@varsity-hub/varsityhub',
  CodeChallengeMethod: { S256: 'S256' },
  ResponseType: { Code: 'code', Token: 'token', IdToken: 'id_token' },
}));

// Capture the config the hook passes to the Google provider
const mockUseAuthRequest = jest.fn((_config?: any) => [
  { url: 'https://accounts.google.com/o/oauth2/auth?...' }, // truthy request
  null,
  jest.fn().mockResolvedValue({ type: 'cancel' }),
]);

jest.mock('expo-auth-session/providers/google', () => ({
  __esModule: true,
  useAuthRequest: (config: any) => mockUseAuthRequest(config),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-application', () => ({
  applicationId: 'com.varsithub.varsityhub-ios',
}));

jest.mock('@/api/entities', () => ({
  User: {
    loginViaGoogle: jest.fn(),
    linkGoogleProvider: jest.fn(),
    me: jest.fn(),
  },
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import { useGoogleAuth } from '@/hooks/useGoogleAuth';

// ─── Tests ───────────────────────────────────────────────────────────────────

const realPlatformOS = Platform.OS;

function setPlatformOS(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

describe('useGoogleAuth — web responseType', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    setPlatformOS(realPlatformOS);
  });

  it('requests responseType id_token on web so Google returns an id_token directly', () => {
    setPlatformOS('web');

    renderHook(() => useGoogleAuth());

    expect(mockUseAuthRequest).toHaveBeenCalledWith(
      expect.objectContaining({ responseType: 'id_token' })
    );
  });

  it('uses the web redirect origin (not a native scheme) on web', () => {
    setPlatformOS('web');

    renderHook(() => useGoogleAuth());

    const config = mockUseAuthRequest.mock.calls[0][0];
    expect(config.redirectUri).toBe('https://varsityhub.app');
  });

  it('does NOT override responseType on iOS — provider default code flow stays intact', () => {
    setPlatformOS('ios');

    renderHook(() => useGoogleAuth());

    const config = mockUseAuthRequest.mock.calls[0][0];
    expect(config.responseType).toBeUndefined();
  });

  it('does NOT override responseType on Android', () => {
    setPlatformOS('android');

    renderHook(() => useGoogleAuth());

    const config = mockUseAuthRequest.mock.calls[0][0];
    expect(config.responseType).toBeUndefined();
  });
});
