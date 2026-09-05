import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { emitSessionExpired, __resetSessionEventsForTest } from '@/utils/sessionEvents';
import { act, render, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth, type AuthContextType } from '../AuthProvider';

const mockIdentity = (id: string) => ({
  id,
  email: `${id}@test.local`,
  role: 'fan',
  onboarding_completed: true,
  email_verified: true,
  preferences: { profile_private: false, notifications: { team_updates: true } },
});
let mockMe = mockIdentity('account-a');
const mockUpdatePreferences = jest.fn();
const mockGetMe = jest.fn(async (..._args: any[]) => mockMe);
const mockGetToken = jest.fn(async (..._args: any[]) => 'synthetic-token' as string | null);
const mockHealth = jest.fn(async (..._args: any[]) => ({ ok: true }));
const mockLogout = jest.fn(async (..._args: any[]) => {});
const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockSegments = ['(tabs)', 'feed'];
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useSegments: () => mockSegments }));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('@/api/auth', () => ({
  __esModule: true,
  default: {
    getToken: (...args: any[]) => mockGetToken(...args),
    logout: (...args: any[]) => mockLogout(...args),
  },
  clearStaleTokensOnFreshInstall: jest.fn(async () => ({ ok: true })),
  migrateKeychainAccessibility: jest.fn(async () => {}),
}));
jest.mock('@/api/entities', () => ({
  User: {
    me: (...args: any[]) => mockGetMe(...args),
    updatePreferences: (...args: any[]) => mockUpdatePreferences(...args),
  },
}));
jest.mock('@/api/http', () => ({
  abortAllInflight: jest.fn(),
  httpGet: (url: string) =>
    url === '/health' ? mockHealth() : Promise.resolve({ plan: 'rookie' }),
}));
jest.mock('@/utils/analytics', () => ({
  analytics: { identify: jest.fn(), reset: jest.fn(), track: jest.fn() },
}));
jest.mock('@/utils/sentry', () => ({
  captureException: jest.fn(),
  setUserContext: jest.fn(),
  captureBreadcrumb: jest.fn(),
}));
jest.mock('@/utils/deepLinks', () => ({
  consumePendingDeepLink: jest.fn(),
  handleDeepLink: jest.fn(),
}));
jest.mock('@/utils/notifications', () => ({ __esModule: true, default: {} }));
jest.mock('@/utils/authTelemetry', () => ({
  buildAuthRedirectFingerprint: jest.fn(),
  navigateWithAuthRedirect: jest.fn(),
}));
jest.mock('@/components/ErrorToast', () => ({ showWarningToast: jest.fn() }));
jest.mock('@/context/PostCacheContext', () => ({ clearPostCacheOnLogout: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ clearPersistedQueryCache: jest.fn(async () => {}) }));

let current: AuthContextType;
let foreground: ((state: AppStateStatus) => void) | undefined;
function Capture() {
  current = useAuth();
  return null;
}
function mountProvider() {
  const view = render(
    <AuthProvider navReady={false}>
      <Capture />
    </AuthProvider>
  );
  return view;
}
async function openProvider() {
  const view = mountProvider();
  await waitFor(() => expect(current.user?.id).toBe('account-a'));
  await waitFor(() => expect(current.loading).toBe(false));
  return view;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const originalPlatform = Platform.OS;
describe('AuthProvider iPhone session restoration audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    __resetSessionEventsForTest();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      foreground = listener;
      return { remove: jest.fn() };
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    (AsyncStorage.setItem as jest.Mock).mockReset().mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue(null);
    mockMe = mockIdentity('account-a');
    mockGetToken.mockReset().mockResolvedValue('synthetic-token');
    mockGetMe.mockReset().mockImplementation(async () => mockMe);
    mockHealth.mockReset().mockResolvedValue({ ok: true });
    mockLogout.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    jest.clearAllTimers();
    jest.useRealTimers();
    __resetSessionEventsForTest();
  });

  it.each([
    ['offline', { status: 0, isNetworkError: true }],
    ['server failure', { status: 503 }],
  ])('preserves an established iPhone session on foreground %s', async (_label, error) => {
    await openProvider();
    mockGetMe.mockRejectedValueOnce(error);
    await act(async () => {
      foreground?.('active');
    });
    expect(mockGetMe).toHaveBeenCalledTimes(2);
    expect(current.user?.id).toBe('account-a');
    expect(current.hasSession).toBe(true);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('preserves an established session when a token storage read throws', async () => {
    await openProvider();
    mockGetToken.mockRejectedValueOnce(new Error('keychain temporarily unavailable'));
    await act(async () => {
      await current.checkAuth();
    });
    expect(current.user?.id).toBe('account-a');
    expect(current.hasSession).toBe(true);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('still clears local identity for an explicit current unauthorized result', async () => {
    await openProvider();
    mockGetMe.mockRejectedValueOnce({ status: 401 });
    await act(async () => {
      await expect(current.checkAuth()).rejects.toMatchObject({ status: 401 });
    });
    expect(current.user).toBeNull();
    expect(current.hasSession).toBe(false);
  });

  it('still clears a terminal session-expired event', async () => {
    await openProvider();
    await act(async () => {
      emitSessionExpired('token_rejected_after_refresh');
    });
    expect(current.user).toBeNull();
    expect(current.hasSession).toBe(false);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('restores a server-confirmed identity even when onboarding cache writes fail', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async key => {
      if (key === '@onboarding_completed_once') throw new Error('temporary AsyncStorage failure');
      return undefined;
    });
    mountProvider();
    await waitFor(() => expect(current.loading).toBe(false));
    expect(mockGetMe).toHaveBeenCalledTimes(1);
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(current.user?.id).toBe('account-a');
    expect(current.hasSession).toBe(true);
  });

  it('restores the stored session automatically after an initial health outage recovers', async () => {
    mockHealth.mockRejectedValueOnce({ status: 503 });
    mountProvider();
    await waitFor(() => expect(current.loading).toBe(false));
    expect(current.healthOk).toBe(false);
    expect(mockGetToken).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20000);
    });
    expect(mockHealth).toHaveBeenCalledTimes(2);
    expect(current.healthOk).toBe(true);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(current.user?.id).toBe('account-a');
  });

  it('ignores an old missing-token read after a newer successful account restoration', async () => {
    await openProvider();
    const oldTokenRead = deferred<string | null>();
    mockGetToken.mockReturnValueOnce(oldTokenRead.promise);
    let oldCheck!: Promise<any>;
    act(() => {
      oldCheck = current.checkAuth();
    });
    mockMe = mockIdentity('account-b');
    await act(async () => {
      await current.checkAuth({ replaceSession: true });
    });
    expect(current.user?.id).toBe('account-b');
    await act(async () => {
      oldTokenRead.resolve(null);
      await oldCheck;
    });
    expect(current.user?.id).toBe('account-b');
    expect(current.hasSession).toBe(true);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('retries a transient cold-start credential read without requiring sign-in', async () => {
    mockGetToken.mockRejectedValueOnce({ isTransientAuthError: true });
    mountProvider();
    await waitFor(() => expect(current.loading).toBe(false));
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(mockGetMe).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20000);
    });
    expect(current.user?.id).toBe('account-a');
    expect(current.hasSession).toBe(true);
    expect(mockGetToken).toHaveBeenCalledTimes(2);
    expect(mockHealth).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it.each(['read', 'stamp'])(
    'retries an initial onboarding identity %s failure without deleting credentials',
    async operation => {
      let failed = false;
      if (operation === 'read') {
        jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async key => {
          if (key === '@last_onboarding_user_id' && !failed) {
            failed = true;
            throw new Error('temporary identity read failure');
          }
          return null;
        });
      } else {
        jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async key => {
          if (key === '@last_onboarding_user_id' && !failed) {
            failed = true;
            throw new Error('temporary identity stamp failure');
          }
        });
      }
      mountProvider();
      await waitFor(() => expect(current.loading).toBe(false));
      expect(current.user).toBeNull();
      expect(current.hasSession).toBe(true);
      expect(mockGetMe).toHaveBeenCalledTimes(1);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(20000);
      });
      expect(current.user?.id).toBe('account-a');
      expect(current.hasSession).toBe(true);
      expect(mockGetMe).toHaveBeenCalledTimes(2);
      expect(mockLogout).not.toHaveBeenCalled();
    }
  );

  it('does not resurrect a pending me response after explicit logout', async () => {
    await openProvider();
    const staleMe = deferred<any>();
    mockGetMe.mockReturnValueOnce(staleMe.promise);
    let oldCheck!: Promise<any>;
    act(() => {
      oldCheck = current.checkAuth({ forceRefresh: true });
    });
    await act(async () => {});
    await act(async () => {
      await current.signOut();
    });
    await act(async () => {
      staleMe.resolve(mockIdentity('account-a'));
      await oldCheck;
    });
    expect(current.user).toBeNull();
    expect(current.hasSession).toBe(false);
  });

  it('does not clear a newer account when an old me request returns unauthorized', async () => {
    await openProvider();
    const staleMe = deferred<any>();
    mockGetMe.mockReturnValueOnce(staleMe.promise);
    let oldCheck!: Promise<any>;
    act(() => {
      oldCheck = current.checkAuth({ forceRefresh: true });
    });
    const observedOldCheck = Promise.allSettled([oldCheck]);
    await act(async () => {});
    mockMe = mockIdentity('account-b');
    await act(async () => {
      await current.checkAuth({ replaceSession: true });
    });
    await act(async () => {
      staleMe.reject({ status: 401 });
      await observedOldCheck;
    });
    expect(current.user?.id).toBe('account-b');
    expect(current.hasSession).toBe(true);
  });

  it('does not start another auth read during delayed logout cleanup', async () => {
    await openProvider();
    const logout = deferred<void>();
    mockLogout.mockReturnValueOnce(logout.promise);
    let out!: Promise<void>;
    act(() => {
      out = current.signOut();
    });
    await act(async () => {
      await current.checkAuth();
    });
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(mockGetMe).toHaveBeenCalledTimes(1);
    await act(async () => {
      logout.resolve();
      await out;
    });
    expect(current.user).toBeNull();
  });

  it('does not replace a pending verification flow with an earlier me result', async () => {
    await openProvider();
    const staleMe = deferred<any>();
    mockGetMe.mockReturnValueOnce(staleMe.promise);
    let oldCheck!: Promise<any>;
    act(() => {
      oldCheck = current.checkAuth({ forceRefresh: true });
    });
    await act(async () => {});
    await act(async () => {
      await current.checkAuth({ pendingVerification: true, email: 'pending@test.local' });
    });
    await act(async () => {
      staleMe.resolve(mockIdentity('account-a'));
      await oldCheck;
    });
    expect(current.user).toBeNull();
    expect(current.hasSession).toBe(true);
    expect(current.pendingVerificationEmail).toBe('pending@test.local');
  });
});
