import { OBProvider } from '@/context/OnboardingContext';
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, render } from '@testing-library/react-native';
import Step2Basic from '../app/onboarding/step-2-basic';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({
    role: 'coach',
  }),
  Stack: { Screen: () => null },
}));

jest.mock('@/api/entities', () => ({
  User: {
    me: jest.fn().mockResolvedValue({ email_verified: true, username: 'coachuser', preferences: {} }),
    usernameAvailable: jest.fn().mockResolvedValue({ available: true }),
    patchMe: jest.fn().mockResolvedValue({ ok: true }),
  },
}));

describe('Onboarding Flow', () => {
  it('should allow user to register as a coach and complete onboarding', async () => {
    const { getByText, getByPlaceholderText } = render(
      <NavigationContainer>
        <OBProvider>
          <Step2Basic />
        </OBProvider>
      </NavigationContainer>
    );

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'Coach User');
      fireEvent.changeText(getByPlaceholderText('Username'), 'coachuser');
      fireEvent.press(getByText('Continue'));
    });

    // Add assertions here to check for navigation or state changes
  });
});
