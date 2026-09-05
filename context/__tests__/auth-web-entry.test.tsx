import React from 'react';
import { Platform } from 'react-native';
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
let mockSegments = ['sign-in'];
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useSegments: () => mockSegments }));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('@/api/auth', () => ({
  __esModule: true,
  default: {
    getToken: jest.fn(async () => null),
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
  navigateWithAuthRedirect: (...args: any[]) => mockNavigate(...args),
}));
jest.mock('@/components/ErrorToast', () => ({ showWarningToast: jest.fn() }));
jest.mock('@/context/PostCacheContext', () => ({ clearPostCacheOnLogout: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ clearPersistedQueryCache: jest.fn(async () => {}) }));

let current: AuthContextType;
function Capture() {
  current = useAuth();
  return null;
}

const originalPlatform = Platform.OS;
describe('AuthProvider initial auth destinations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each(['sign-in', 'sign-up'])(
    'preserves direct web /%s once guest bootstrap settles',
    async route => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      mockSegments = [route];
      render(
        <AuthProvider navReady>
          <Capture />
        </AuthProvider>
      );
      await waitFor(() => expect(current.loading).toBe(false));
      await act(async () => {});
      expect(current.user).toBeNull();
      expect(mockNavigate).not.toHaveBeenCalled();
    }
  );

  it('still sends a native restored sign-in screen to the guest feed', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockSegments = ['sign-in'];
    render(
      <AuthProvider navReady>
        <Capture />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        mockRouter,
        expect.objectContaining({ to: '/(tabs)/feed', reason: 'startup_signin_restore' })
      )
    );
  });

  it('still protects a direct web settings visit from a guest', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockSegments = ['settings'];
    render(
      <AuthProvider navReady>
        <Capture />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        mockRouter,
        expect.objectContaining({ to: '/(tabs)/feed', reason: 'unauthenticated' })
      )
    );
  });
});
