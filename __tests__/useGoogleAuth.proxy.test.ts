/**
 * useGoogleAuth — proxy detection unit tests
 *
 * Bug: Constants.appOwnership === null was true in EAS/TestFlight builds,
 * which accidentally activated the auth.expo.io proxy in production.
 *
 * Fix: switched to Constants.executionEnvironment === 'storeClient'
 * which is only true in Expo Go, never in standalone / EAS builds.
 *
 * These tests verify correct proxy detection across all build environments.
 */

import { renderHook } from '@testing-library/react-native';

// ─── Mutable mock so we can set executionEnvironment per-test ───────────────
// jest.mock is hoisted; variables prefixed with 'mock' are accessible in the factory.

const mockConstantsData = {
  executionEnvironment: 'standalone' as string | null,
  appOwnership: null as string | null,
  expoConfig: {
    slug: 'varsityhub',
    owner: 'varsity-hub',
    extra: {
      EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME: '@varsity-hub/varsityhub',
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:
        '814866365020-ia09lnm6he2prvaivrp8sblh7oeh9ic0.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:
        '814866365020-ml5i55hgdne80i2hfd3ub5nggfpvrr2r.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:
        '814866365020-d7dk3k9gf49jodhnbraps8p7l9jrfs10.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID:
        '814866365020-ml5i55hgdne80i2hfd3ub5nggfpvrr2r.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_FORCE_PROXY: '0',
      EXPO_PUBLIC_API_URL: 'https://api.varsityhub.test',
      EXPO_PUBLIC_APP_SCHEME: 'varsityhubmobile',
    },
  },
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: mockConstantsData,
}));

// ─── Auth session spies ──────────────────────────────────────────────────────

const mockMakeRedirectUri = jest.fn(
  (opts?: { native?: string; scheme?: string }) =>
    opts?.native ?? opts?.scheme ?? 'varsityhubmobile://oauthredirect'
);

const mockGetRedirectUrl = jest.fn(() => 'https://auth.expo.io/@varsity-hub/varsityhub');

jest.mock('expo-auth-session', () => ({
  __esModule: true,
  makeRedirectUri: (opts: any) => mockMakeRedirectUri(opts),
  getRedirectUrl: () => mockGetRedirectUrl(),
  CodeChallengeMethod: { S256: 'S256' },
  ResponseType: { Code: 'code', Token: 'token' },
}));

const mockUseAuthRequest = jest.fn(() => [
  { url: 'https://accounts.google.com/o/oauth2/auth?...' }, // truthy request
  null,
  jest.fn().mockResolvedValue({ type: 'cancel' }),
]);

jest.mock('expo-auth-session/providers/google', () => ({
  __esModule: true,
  useAuthRequest: () => mockUseAuthRequest(),
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
    me: jest.fn(),
  },
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import { useGoogleAuth } from '@/hooks/useGoogleAuth';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useGoogleAuth — proxy detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Core fix ──────────────────────────────────────────────────────────────

  it('does NOT use proxy in EAS / TestFlight build (executionEnvironment = "standalone")', () => {
    mockConstantsData.executionEnvironment = 'standalone';
    mockConstantsData.appOwnership = null; // This was the old false-trigger

    renderHook(() => useGoogleAuth());

    // Native iOS redirect must be used
    expect(mockMakeRedirectUri).toHaveBeenCalledWith(
      expect.objectContaining({
        native: expect.stringContaining('com.googleusercontent.apps.'),
      })
    );
    // Proxy path must NOT be taken
    expect(mockGetRedirectUrl).not.toHaveBeenCalled();
  });

  it('does NOT use proxy when executionEnvironment is null (bare/web)', () => {
    mockConstantsData.executionEnvironment = null;
    mockConstantsData.appOwnership = null;

    renderHook(() => useGoogleAuth());

    expect(mockGetRedirectUrl).not.toHaveBeenCalled();
  });

  it('DOES use proxy in Expo Go (executionEnvironment = "storeClient")', () => {
    mockConstantsData.executionEnvironment = 'storeClient';
    mockConstantsData.appOwnership = 'expo';

    renderHook(() => useGoogleAuth());

    // Proxy path must be taken
    expect(mockGetRedirectUrl).toHaveBeenCalled();
    // Native Google scheme must NOT be used
    expect(mockMakeRedirectUri).not.toHaveBeenCalledWith(
      expect.objectContaining({
        native: expect.stringContaining('com.googleusercontent.apps.'),
      })
    );
  });

  // ── FORCE_PROXY override ──────────────────────────────────────────────────

  it('respects EXPO_PUBLIC_GOOGLE_FORCE_PROXY = "0" — proxy stays off in production', () => {
    // "0" must parse as false; if it parsed as truthy the proxy would be forced on
    mockConstantsData.executionEnvironment = 'standalone';
    mockConstantsData.appOwnership = null;

    renderHook(() => useGoogleAuth());

    expect(mockGetRedirectUrl).not.toHaveBeenCalled();
  });

  // ── Redirect URI shape ────────────────────────────────────────────────────

  it('builds the correct reversed-client-ID redirect URI for iOS production', () => {
    mockConstantsData.executionEnvironment = 'standalone';
    mockConstantsData.appOwnership = null;

    renderHook(() => useGoogleAuth());

    expect(mockMakeRedirectUri).toHaveBeenCalledWith(
      expect.objectContaining({
        native:
          'com.googleusercontent.apps.814866365020-ia09lnm6he2prvaivrp8sblh7oeh9ic0:/oauthredirect',
      })
    );
  });

  // ── Hook readiness ────────────────────────────────────────────────────────

  it('is ready when iOS client ID is configured and request object exists', () => {
    mockConstantsData.executionEnvironment = 'standalone';

    const { result } = renderHook(() => useGoogleAuth());

    expect(result.current.ready).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
