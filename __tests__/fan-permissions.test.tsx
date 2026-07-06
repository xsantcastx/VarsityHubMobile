import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockRouterReplace = jest.fn();
const mockRegisterPushToken = jest.fn(async () => undefined);
const mockCheckAuth = jest.fn(
  async (): Promise<any> => ({
    id: 'fan-1',
    role: 'fan',
    email_verified: true,
    onboarding_completed: true,
    preferences: { role: 'fan', onboarding_completed: true },
  })
);

let mockAuthUser: any = {
  id: 'fan-1',
  role: 'fan',
  email_verified: true,
  onboarding_completed: true,
  preferences: { role: 'fan', onboarding_completed: true },
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
}));

jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    checkAuth: mockCheckAuth,
    registerPushToken: mockRegisterPushToken,
  }),
}));

jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));

const mockGetNotifPerms = jest.fn(async () => ({ status: 'undetermined' }));
const mockReqNotifPerms = jest.fn(async () => ({ status: 'granted' }));
jest.mock('@/utils/notifications', () => ({
  __esModule: true,
  default: {
    getPermissionsAsync: () => mockGetNotifPerms(),
    requestPermissionsAsync: () => mockReqNotifPerms(),
  },
}));

const mockGetLocPerms = jest.fn(async () => ({ status: 'undetermined' }));
const mockReqLocPerms = jest.fn(async () => ({ status: 'granted' }));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => mockGetLocPerms(),
  requestForegroundPermissionsAsync: () => mockReqLocPerms(),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import FanPermissions from '../app/onboarding/fan-permissions';

describe('FanPermissions screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = {
      id: 'fan-1',
      role: 'fan',
      email_verified: true,
      onboarding_completed: true,
      preferences: { role: 'fan', onboarding_completed: true },
    };
  });

  it('renders a push-notifications toggle and a location toggle', () => {
    const screen = render(<FanPermissions />);
    expect(screen.getByTestId('fan-permissions-push-toggle')).toBeTruthy();
    expect(screen.getByTestId('fan-permissions-location-toggle')).toBeTruthy();
  });

  it('refreshes the auth snapshot BEFORE navigating into the app on Enable & Continue', async () => {
    const screen = render(<FanPermissions />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Enable notifications and location'));
    });

    await waitFor(() => {
      expect(mockCheckAuth).toHaveBeenCalled();
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/feed');
    });

    // The whole loop bug was navigating with a stale user. checkAuth must run first.
    const checkAuthOrder = mockCheckAuth.mock.invocationCallOrder[0];
    const replaceOrder = mockRouterReplace.mock.invocationCallOrder[0];
    expect(checkAuthOrder).toBeLessThan(replaceOrder);
  });

  it('refreshes the auth snapshot BEFORE navigating into the app on Skip', async () => {
    const screen = render(<FanPermissions />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Skip permissions for now'));
    });

    await waitFor(() => {
      expect(mockCheckAuth).toHaveBeenCalled();
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/feed');
    });

    const checkAuthOrder = mockCheckAuth.mock.invocationCallOrder[0];
    const replaceOrder = mockRouterReplace.mock.invocationCallOrder[0];
    expect(checkAuthOrder).toBeLessThan(replaceOrder);
  });

  it('does not request a permission when its toggle is turned off', async () => {
    const screen = render(<FanPermissions />);

    // Turn both toggles off, then continue.
    await act(async () => {
      fireEvent(screen.getByTestId('fan-permissions-push-toggle'), 'valueChange', false);
      fireEvent(screen.getByTestId('fan-permissions-location-toggle'), 'valueChange', false);
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Enable notifications and location'));
    });

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/feed');
    });
    expect(mockReqNotifPerms).not.toHaveBeenCalled();
    expect(mockReqLocPerms).not.toHaveBeenCalled();
  });
});
