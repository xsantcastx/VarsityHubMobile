import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, TextInput } from 'react-native';

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockMarkOnboardingCompleteLocally = jest.fn(async () => undefined);
const mockRegisterPushToken = jest.fn(async () => undefined);
const mockCheckAuth = jest.fn(async () => ({
  id: 'fan-1',
  email_verified: true,
  role: 'fan',
  onboarding_completed: true,
  username: 'fan-1',
  preferences: { role: 'fan', onboarding_completed: true },
}));
const mockSetOB = jest.fn();
const mockSetProgress = jest.fn();
const mockDispatch = jest.fn();
const mockPatchMe = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockCompleteOnboarding = jest.fn();
const mockUsernameAvailable = jest.fn(async () => ({ available: true }));
const mockUserMe = jest.fn();

let mockOnboardingState: any = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: jest.fn(),
    canGoBack: () => true,
  }),
  Stack: { Screen: () => null },
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => cb(),
}));

jest.mock('@/components/ui/DateField', () => (props: any) => (
  <TextInput testID="dob-input" value={props.value} onChangeText={props.onChange} />
));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <TextInput {...props} />,
}));

jest.mock('@/components/ui/PrimaryButton', () => (props: any) => (
  <Pressable
    testID={props.testID}
    onPress={props.disabled ? undefined : props.onPress}
    accessibilityState={{ disabled: !!props.disabled }}
  >
    <Text>{props.label}</Text>
  </Pressable>
));

jest.mock('../app/onboarding/components/OnboardingLayout', () => (props: any) => (
  <>{props.children}</>
));
jest.mock('@/components/ZipCodeMapPreview', () => ({ ZipCodeMapPreview: () => null }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/utils/navigation', () => ({ safeGoBack: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}));
jest.mock('@/api/upload', () => ({
  uploadFile: jest.fn(),
}));
jest.mock('@/config/env', () => ({
  getConfig: () => ({ apiUrl: 'https://api.test' }),
}));
jest.mock('@/utils/notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}));
jest.mock('@/utils/sentry', () => ({
  captureBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));
jest.mock('@/utils/materializeICloudAsset', () => ({
  materializeICloudAssetIfNeeded: jest.fn(async (uri: string) => uri),
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    checkAuth: mockCheckAuth,
    markOnboardingCompleteLocally: mockMarkOnboardingCompleteLocally,
    registerPushToken: mockRegisterPushToken,
  }),
}));
jest.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    state: { role: 'fan', ...mockOnboardingState },
    setState: mockSetOB,
    setProgress: mockSetProgress,
    dispatch: mockDispatch,
    canNavigate: true,
  }),
}));
jest.mock('@/api/entities', () => ({
  User: {
    me: mockUserMe,
    usernameAvailable: mockUsernameAvailable,
    patchMe: mockPatchMe,
    updatePreferences: mockUpdatePreferences,
    completeOnboarding: mockCompleteOnboarding,
  },
}));

import Step2Basic from '../app/onboarding/step-2-basic';

describe('Onboarding Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPatchMe.mockResolvedValue({ ok: true });
    mockUpdatePreferences.mockResolvedValue({ ok: true });
    mockCompleteOnboarding.mockResolvedValue({ ok: true });
    mockCheckAuth.mockResolvedValue({
      id: 'fan-1',
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      username: 'fan-1',
      preferences: { role: 'fan', onboarding_completed: true },
    });
  });

  it('routes coaches from step-2 to coach-application after saving canonical coach fields', async () => {
    mockOnboardingState = { role: 'coach', affiliation: undefined, dob: '' };
    mockCheckAuth.mockResolvedValue({
      id: 'coach-1',
      email_verified: true,
      role: 'coach',
      onboarding_completed: false,
      username: 'coachuser',
      preferences: { role: 'coach', onboarding_completed: false },
    });

    const screen = render(<Step2Basic />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-step2-username-input').props.value).toBe('coachuser');
    });

    fireEvent.changeText(screen.getByTestId('dob-input'), '1990-01-01');
    fireEvent.changeText(screen.getByTestId('onboarding-step2-zip-input'), '12345');

    await act(async () => {
      fireEvent.press(screen.getByTestId('onboarding-step2-continue-button'));
    });

    await waitFor(() => {
      expect(mockPatchMe).toHaveBeenCalledWith({ username: 'coachuser' });
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        affiliation: 'other',
        dob: '1990-01-01',
        role: 'coach',
        zip_code: '12345',
      });
      expect(mockCompleteOnboarding).not.toHaveBeenCalled();
      expect(mockSetProgress).toHaveBeenCalledWith(2);
      expect(mockRouterReplace).toHaveBeenCalledWith('/onboarding/coach-application');
    });
  });

  it('completes fan onboarding and routes to tabs from step-2', async () => {
    mockOnboardingState = { role: 'fan', affiliation: undefined, dob: '' };
    mockCheckAuth.mockResolvedValue({
      id: 'fan-1',
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      username: 'fanuser',
      preferences: { role: 'fan', onboarding_completed: true },
    });

    const screen = render(<Step2Basic />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-step2-username-input').props.value).toBe('fanuser');
    });

    fireEvent.changeText(screen.getByTestId('dob-input'), '2000-01-01');

    await act(async () => {
      fireEvent.press(screen.getByTestId('onboarding-step2-continue-button'));
    });

    await waitFor(() => {
      expect(mockPatchMe).toHaveBeenCalledWith({ username: 'fanuser' });
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        affiliation: 'other',
        dob: '2000-01-01',
      });
      expect(mockCompleteOnboarding).toHaveBeenCalledWith({
        affiliation: 'other',
        dob: '2000-01-01',
        role: 'fan',
        username: 'fanuser',
        zip_code: undefined,
      });
      expect(mockCheckAuth).toHaveBeenCalled();
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)');
      expect(mockMarkOnboardingCompleteLocally).toHaveBeenCalled();
      expect(mockRegisterPushToken).toHaveBeenCalled();
    });
  });
});
