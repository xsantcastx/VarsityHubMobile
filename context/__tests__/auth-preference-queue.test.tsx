import React from 'react';
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
const mockLogout = jest.fn(async (..._args: any[]) => {});
const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockSegments = ['(tabs)', 'feed'];
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useSegments: () => mockSegments }));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('@/api/auth', () => ({
  __esModule: true,
  default: {
    getToken: jest.fn(async () => 'synthetic-token'),
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
  httpGet: jest.fn(async () => ({ ok: true, plan: 'rookie' })),
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
function Capture() {
  current = useAuth();
  return null;
}
async function openProvider() {
  const view = render(
    <AuthProvider navReady={false}>
      <Capture />
    </AuthProvider>
  );
  await waitFor(() => expect(current.user?.id).toBe('account-a'));
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

describe('AuthProvider preference queue with actual provider lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockMe = mockIdentity('account-a');
    mockGetMe.mockReset().mockImplementation(async () => mockMe);
    mockUpdatePreferences.mockReset();
    mockLogout.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  it('serializes writes and keeps saving after the settings consumer unmounts', async () => {
    const first = deferred<any>();
    mockUpdatePreferences.mockReturnValueOnce(first.promise).mockResolvedValueOnce({
      preferences: { profile_private: true, notifications: { team_updates: false } },
    });
    const view = await openProvider();
    let save1!: Promise<any>, save2!: Promise<any>;
    act(() => {
      save1 = current.savePreferences({ profile_private: true });
      save2 = current.savePreferences({ notifications: { team_updates: false } });
    });
    await act(async () => {});
    expect(mockUpdatePreferences).toHaveBeenCalledTimes(1);
    expect(current.preferenceSaveState.pending).toBe(2);
    view.rerender(<AuthProvider navReady={false}>{null}</AuthProvider>);
    await act(async () => {
      first.resolve({ preferences: { profile_private: true } });
      await Promise.all([save1, save2]);
    });
    expect(mockUpdatePreferences).toHaveBeenCalledTimes(2);
    view.rerender(
      <AuthProvider navReady={false}>
        <Capture />
      </AuthProvider>
    );
    expect(current.user?.preferences).toEqual({
      profile_private: true,
      notifications: { team_updates: false },
    });
    expect(current.preferenceSaveState).toEqual({ pending: 0, error: false, saved: true });
  });
  it('a failed save does not block the next write and its failure stays visible', async () => {
    mockUpdatePreferences.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      preferences: { notifications: { team_updates: false }, profile_private: false },
    });
    await openProvider();
    let results: any;
    await act(async () => {
      results = await Promise.allSettled([
        current.savePreferences({ profile_private: true }),
        current.savePreferences({ notifications: { team_updates: false } }),
      ]);
    });
    expect(results.map((r: any) => r.status)).toEqual(['rejected', 'fulfilled']);
    expect(current.user?.preferences).toMatchObject({ profile_private: false });
    expect(current.preferenceSaveState).toMatchObject({ pending: 0, error: true });
  });
  it('account switch skips the old queued write and accepts the new account immediately', async () => {
    const first = deferred<any>();
    mockUpdatePreferences
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue({ preferences: { profile_private: true } });
    await openProvider();
    let old1!: Promise<any>, old2!: Promise<any>;
    act(() => {
      old1 = current.savePreferences({ profile_private: true });
      old2 = current.savePreferences({ notifications: { team_updates: false } });
    });
    const oldResults = Promise.allSettled([old1, old2]);
    await act(async () => {});
    expect(mockUpdatePreferences).toHaveBeenCalledTimes(1);
    mockMe = mockIdentity('account-b');
    await act(async () => {
      await current.checkAuth({ replaceSession: true });
    });
    expect(current.user?.id).toBe('account-b');
    await act(async () => {
      await current.savePreferences({ profile_private: true });
    });
    expect(mockUpdatePreferences).toHaveBeenCalledTimes(2);
    await act(async () => {
      first.resolve({ preferences: { profile_private: false } });
      await oldResults;
    });
    expect((await oldResults).map(r => r.status)).toEqual(['rejected', 'rejected']);
    expect(mockUpdatePreferences).toHaveBeenCalledTimes(2);
    expect(current.user?.id).toBe('account-b');
    expect(current.user?.preferences).toMatchObject({ profile_private: true });
  });
  it('logout invalidates queued work before slow credential cleanup completes', async () => {
    const first = deferred<any>(),
      logout = deferred<void>();
    mockUpdatePreferences.mockReturnValue(first.promise);
    mockLogout.mockReturnValue(logout.promise);
    await openProvider();
    let writes!: Promise<any>, out!: Promise<void>;
    act(() => {
      writes = Promise.allSettled([
        current.savePreferences({ profile_private: true }),
        current.savePreferences({ notifications: { team_updates: false } }),
      ]);
    });
    await act(async () => {});
    act(() => {
      out = current.signOut();
    });
    await act(async () => {
      first.resolve({ preferences: { profile_private: true } });
      await writes;
    });
    expect(mockUpdatePreferences).toHaveBeenCalledTimes(1);
    await act(async () => {
      logout.resolve();
      await out;
    });
    expect(current.user).toBeNull();
    expect(current.preferenceSaveState.pending).toBe(0);
  });
  it('an earlier me snapshot cannot overwrite a confirmed preference save', async () => {
    await openProvider();
    const snapshot = deferred<any>();
    mockGetMe.mockReturnValueOnce(snapshot.promise);
    let refreshing!: Promise<any>;
    act(() => {
      refreshing = current.checkAuth({ forceRefresh: true });
    });
    await act(async () => {});
    mockUpdatePreferences.mockResolvedValue({ preferences: { profile_private: true } });
    await act(async () => {
      await current.savePreferences({ profile_private: true });
    });
    await act(async () => {
      snapshot.resolve(mockIdentity('account-a'));
      await refreshing;
    });
    expect(current.user?.preferences).toMatchObject({ profile_private: true });
  });
});
