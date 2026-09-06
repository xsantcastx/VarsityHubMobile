import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

const initialUser = {
  id: 'settings-audit-fan',
  email: 'settings-audit@example.test',
  role: 'fan',
  onboarding_completed: true,
  email_verified: true,
  preferences: {
    profile_private: false,
    notifications: {
      game_event_reminders: true,
      team_updates: true,
      comments_upvotes: true,
      follows_notifications: true,
      messages_notifications: true,
    },
  },
};
let mockUser = JSON.parse(JSON.stringify(initialUser));
let mockQueue: Promise<unknown> = Promise.resolve();
const mockSavePreferences = (patch: any) => {
  const save = mockQueue
    .catch(() => undefined)
    .then(async () => {
      await mockUpdatePreferences(patch);
      mockUser = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          ...patch,
          notifications: { ...mockUser.preferences.notifications, ...patch.notifications },
        },
      };
      return mockUser.preferences;
    });
  mockQueue = save;
  return save;
};
const mockCheckAuth = jest.fn().mockResolvedValue(mockUser);
const mockUpdatePreferences = jest.fn().mockResolvedValue({});

jest.mock('@/api/entities', () => ({
  User: { updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args) },
}));
jest.mock('@/api/http', () => ({ httpGet: jest.fn().mockResolvedValue({}) }));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    checkAuth: mockCheckAuth,
    savePreferences: mockSavePreferences,
    isAdmin: false,
  }),
}));
jest.mock('@/context/OnboardingContext', () => ({ useOnboardingOptional: () => null }));
jest.mock('@/hooks/useCustomColorScheme', () => ({
  useCustomColorScheme: () => 'light',
  useThemePreference: () => ({ themePreference: 'system', setThemePreference: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () =>
  require('@/test-utils/screenMocks').safeAreaMock()
);
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/utils/sentry', () => ({ captureException: jest.fn() }));

import SettingsScreen from '../index';

async function openSettings() {
  const result = render(<SettingsScreen />);
  await act(async () => {});
  return result;
}

describe('Settings persistence regressions', () => {
  beforeEach(() => {
    mockUser = JSON.parse(JSON.stringify(initialUser));
    mockQueue = Promise.resolve();
    jest.useFakeTimers();
    mockUpdatePreferences.mockReset().mockResolvedValue({});
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('private-profile toggle starts saving without a debounce', async () => {
    await openSettings();
    fireEvent.press(screen.getAllByLabelText('Privacy section')[0]);
    fireEvent(screen.getByLabelText('Private Profile'), 'valueChange', true);
    await act(async () => {
      jest.advanceTimersByTime(301);
    });
    expect(mockUpdatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ profile_private: true })
    );
  });

  it('leaving settings immediately does not cancel a privacy save', async () => {
    const view = await openSettings();
    fireEvent.press(screen.getAllByLabelText('Privacy section')[0]);
    fireEvent(screen.getByLabelText('Private Profile'), 'valueChange', true);
    expect(screen.getByLabelText('Private Profile').props.value).toBe(true);
    view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ profile_private: true });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('rolls back all changes when both queued saves fail', async () => {
    mockUpdatePreferences.mockRejectedValue(new Error('offline'));
    await openSettings();
    fireEvent(screen.getByLabelText('Game/Event Reminders'), 'valueChange', false);
    fireEvent(screen.getByLabelText('Team Updates'), 'valueChange', false);
    await act(async () => {
      jest.advanceTimersByTime(301);
    });
    expect(Alert.alert).toHaveBeenCalledWith('Update failed', expect.any(String));
    expect(screen.getByLabelText('Game/Event Reminders').props.value).toBe(true);
    expect(screen.getByLabelText('Team Updates').props.value).toBe(true);
  });

  it('reopening settings shows the last confirmed privacy value', async () => {
    const first = await openSettings();
    fireEvent.press(screen.getAllByLabelText('Privacy section')[0]);
    fireEvent(screen.getByLabelText('Private Profile'), 'valueChange', true);
    await act(async () => {
      jest.advanceTimersByTime(301);
    });
    expect(mockUpdatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ profile_private: true })
    );
    first.unmount();
    await openSettings();
    fireEvent.press(screen.getAllByLabelText('Privacy section')[0]);
    expect(screen.getByLabelText('Private Profile').props.value).toBe(true);
  });
  it('switching accounts clears the previous account optimistic preferences and callbacks', async () => {
    let fail!: (error: Error) => void;
    mockUpdatePreferences.mockReturnValueOnce(
      new Promise((_, reject) => {
        fail = reject;
      })
    );
    mockCheckAuth.mockResolvedValue(mockUser);
    const view = await openSettings();
    fireEvent.press(screen.getAllByLabelText('Privacy section')[0]);
    fireEvent(screen.getByLabelText('Private Profile'), 'valueChange', true);
    await act(async () => {});
    expect(screen.getByLabelText('Private Profile').props.value).toBe(true);
    mockUser = { ...JSON.parse(JSON.stringify(initialUser)), id: 'settings-account-b' };
    mockCheckAuth.mockResolvedValue(mockUser);
    view.rerender(<SettingsScreen />);
    await act(async () => {});
    fireEvent.press(screen.getAllByLabelText('Privacy section')[0]);
    expect(screen.getByLabelText('Private Profile').props.value).toBe(false);
    await act(async () => {
      fail(new Error('previous account request cancelled'));
    });
    expect(screen.getByLabelText('Private Profile').props.value).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
