import React from 'react';
import { render, fireEvent, act, screen, waitFor } from '@testing-library/react-native';

jest.mock('@/api/entities', () => ({
  User: {
    verifyEmail: jest.fn(),
    requestVerification: jest.fn(),
    me: jest.fn(),
  },
}));

jest.mock('@/context/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => (global as any).__paramsMock || {},
  Stack: { Screen: () => null },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onPress, disabled }: any) => (
    <button disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChangeText, ...rest }: any) => (
    <input value={value} onChange={(e) => onChangeText?.(e.target.value)} {...rest} />
  ),
}));

jest.mock('@/shared/hooks/useCustomColorScheme', () => ({
  useCustomColorScheme: () => 'light',
  useThemePreference: () => ({ themePreference: 'light', setThemePreference: jest.fn() }),
  ThemeProvider: ({ children }: any) => children,
}));

describe('VerifyEmailScreen', () => {
const originalEnv = process.env;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (global as any).__paramsMock = {};
  process.env = { ...originalEnv };
});

afterEach(() => {
  jest.useRealTimers();
  process.env = originalEnv;
});

  it('shows dev code button and auto-verifies with configured dev code', async () => {
    const useAuth = require('@/context/AuthProvider').useAuth as jest.Mock;
    const User = require('@/api/entities').User as {
      verifyEmail: jest.Mock;
      requestVerification: jest.Mock;
      me: jest.Mock;
    };
    useAuth.mockReturnValue({
      pendingVerificationEmail: 'user@example.com',
      user: { email: 'user@example.com', preferences: { role: 'fan' } },
      checkAuth: jest.fn().mockResolvedValue(undefined),
      markOnboardingCompleteLocally: jest.fn().mockResolvedValue(undefined),
    });
    User.verifyEmail.mockResolvedValue(undefined);
    User.requestVerification.mockResolvedValue({});
    User.me.mockResolvedValue({ email: 'user@example.com', preferences: { role: 'fan' } });

    (global as any).__paramsMock = { devCode: '654321' };
    const VerifyEmailScreen = require('../verify-email').default;

    render(<VerifyEmailScreen />);

    const devButton = await screen.findByText(/Use dev code/i);
    expect(devButton).toBeTruthy();

    await act(async () => {
      fireEvent.press(devButton);
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(User.verifyEmail).toHaveBeenCalledWith('654321');
    });
  });

  it('shows error when resending without email or dev code available', async () => {
    const useAuth = require('@/context/AuthProvider').useAuth as jest.Mock;
    const User = require('@/api/entities').User as {
      verifyEmail: jest.Mock;
      requestVerification: jest.Mock;
      me: jest.Mock;
    };
    useAuth.mockReturnValue({
      pendingVerificationEmail: null,
      user: null,
      checkAuth: jest.fn().mockResolvedValue(undefined),
      markOnboardingCompleteLocally: jest.fn().mockResolvedValue(undefined),
    });
    User.requestVerification.mockResolvedValue({});
    User.verifyEmail.mockResolvedValue(undefined);
    User.me.mockResolvedValue({});

    const VerifyEmailScreen = require('../verify-email').default;

    render(<VerifyEmailScreen />);

    const resend = await screen.findByText(/Resend Code/i);
    fireEvent.press(resend);

    await waitFor(() => {
      expect(screen.getByText(/no email on file/i)).toBeTruthy();
    });
  });
});
