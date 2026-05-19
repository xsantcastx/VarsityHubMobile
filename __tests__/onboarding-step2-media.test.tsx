import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, TextInput } from 'react-native';

const mockRouterReplace = jest.fn();
const mockMarkOnboardingCompleteLocally = jest.fn(async () => undefined);
const mockRegisterPushToken = jest.fn(async () => undefined);
const mockSetOB = jest.fn();
const mockSetProgress = jest.fn();
const mockDispatch = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockUploadFile = jest.fn();
const mockPatchMe = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockCompleteOnboarding = jest.fn();
const mockGetFreshPostAuthState = jest.fn(async () => ({
  decision: { route: '/(tabs)' },
}));
const mockAuthUser = {
  id: 'user-1',
  email_verified: true,
  username: 'fanuser',
  role: 'fan',
  onboarding_completed: true,
  preferences: { role: 'fan', onboarding_completed: true },
};
const mockCheckAuth = jest.fn(async () => mockAuthUser);

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
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

jest.mock('../app/onboarding/components/OnboardingLayout', () => (props: any) => <>{props.children}</>);
jest.mock('@/components/ZipCodeMapPreview', () => ({ ZipCodeMapPreview: () => null }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/utils/navigation', () => ({ safeGoBack: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: any[]) => mockLaunchImageLibraryAsync(...args),
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}));
jest.mock('@/api/upload', () => ({
  uploadFile: (...args: any[]) => mockUploadFile(...args),
}));
jest.mock('@/config/env', () => ({
  getConfig: () => ({ apiUrl: 'https://api.test' }),
}));
jest.mock('@/utils/notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}));
jest.mock('@/utils/postMutationAuth', () => ({
  getFreshPostAuthState: mockGetFreshPostAuthState,
}));
jest.mock('@/utils/sentry', () => ({
  captureBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    checkAuth: mockCheckAuth,
    markOnboardingCompleteLocally: mockMarkOnboardingCompleteLocally,
    registerPushToken: mockRegisterPushToken,
  }),
}));
jest.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    state: { role: 'fan', affiliation: undefined, dob: '' },
    setState: mockSetOB,
    setProgress: mockSetProgress,
    dispatch: mockDispatch,
    canNavigate: true,
  }),
}));
jest.mock('@/api/entities', () => ({
  User: {
    me: jest.fn(async () => ({
      id: 'user-1',
      email_verified: true,
      username: 'fanuser',
      preferences: {},
    })),
    usernameAvailable: jest.fn(async () => ({ available: true })),
    patchMe: (...args: any[]) => mockPatchMe(...args),
    updatePreferences: (...args: any[]) => mockUpdatePreferences(...args),
    completeOnboarding: (...args: any[]) => mockCompleteOnboarding(...args),
  },
}));

import Step2Basic from '../app/onboarding/step-2-basic';

describe('Step2Basic optional media persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckAuth.mockResolvedValue(mockAuthUser);
    mockGetFreshPostAuthState.mockResolvedValue({ decision: { route: '/(tabs)' } });
    mockPatchMe.mockResolvedValue({ ok: true });
    mockUpdatePreferences.mockResolvedValue({ ok: true });
    mockCompleteOnboarding.mockResolvedValue({ ok: true });
    mockUploadFile
      .mockResolvedValueOnce({ url: 'https://cdn.test/avatar.jpg' })
      .mockResolvedValueOnce({ url: 'https://cdn.test/header.jpg' });
    mockLaunchImageLibraryAsync
      .mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///avatar.jpg' }] })
      .mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///header.jpg' }] });
  });

  it('keeps onboarding flow moving while persisting avatar and header image data', async () => {
    const { getByTestId } = render(<Step2Basic />);

    await waitFor(() => {
      expect(mockCheckAuth).toHaveBeenCalled();
      expect(getByTestId('onboarding-step2-username-input').props?.value).toBe('fanuser');
    });

    await act(async () => {
      fireEvent.press(getByTestId('onboarding-step2-avatar-picker'));
      fireEvent.press(getByTestId('onboarding-step2-header-picker'));
    });

    fireEvent.changeText(getByTestId('dob-input'), '2000-01-01');

    await waitFor(() => {
      expect(
        getByTestId('onboarding-step2-continue-button').props?.accessibilityState?.disabled
      ).toBe(false);
    });

    await act(async () => {
      fireEvent.press(getByTestId('onboarding-step2-continue-button'));
    });

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'fan',
          username: 'fanuser',
          dob: '2000-01-01',
        })
      );
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)');

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledTimes(2);
    });

    expect(mockPatchMe).toHaveBeenCalledWith({ username: 'fanuser' });
    expect(mockPatchMe).toHaveBeenCalledWith({
      avatar_url: 'https://cdn.test/avatar.jpg',
    });
    expect(mockUpdatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        affiliation: 'other',
        dob: '2000-01-01',
      })
    );
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      header_image_url: 'https://cdn.test/header.jpg',
      header_image_focus_y: 0,
    });
  });
});
