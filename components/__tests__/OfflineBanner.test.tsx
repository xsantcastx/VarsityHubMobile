import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { AuthContextType } from '@/context/AuthProvider';
import { useAuth } from '@/context/AuthProvider';
import { OfflineBanner } from '../OfflineBanner';

jest.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    configure: jest.fn(),
  },
  NetInfoStateType: {},
}));

jest.mock('@/context/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const createAuthMock = (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
  user: null,
  hasSession: false,
  pendingVerificationEmail: null,
  loading: false,
  isAdmin: false,
  subscriptionTier: 'rookie',
  hasActiveSubscription: false,
  healthOk: true,
  healthError: null,
  checkAuth: jest.fn(),
  signOut: jest.fn(),
  registerPushToken: jest.fn(),
  markOnboardingCompleteLocally: jest.fn(),
  markOnboardingIncompleteLocally: jest.fn(),
  ...overrides,
});

describe('OfflineBanner', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when API health is OK', () => {
    mockedUseAuth.mockReturnValue(createAuthMock());

    const { toJSON } = render(<OfflineBanner />);
    expect(toJSON()).toBeNull();
  });

  it('shows error banner and retries authentication when pressed', async () => {
    const checkAuth = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      createAuthMock({
        healthOk: false,
        healthError: 'API unreachable',
        checkAuth,
      })
    );

    const { getByText } = render(<OfflineBanner />);

    expect(getByText('Unable to connect to server')).toBeTruthy();

    fireEvent.press(getByText('Retry'));

    await waitFor(() => {
      expect(checkAuth).toHaveBeenCalledTimes(1);
    });
  });

  it('never renders raw internal error details from healthError', () => {
    // Raw transport errors can contain internals (RN blob registry ids, the
    // origin API URL). The banner must always show a fixed generic message.
    const leakyMessages = [
      'Unable to resolve data for blob: 21605BF3-2C11-456E-B8B0-9D168188E83B',
      'Cannot connect to server at https://api-production-8ac3.up.railway.app. Please check your internet connection and try again.',
    ];
    for (const leaked of leakyMessages) {
      mockedUseAuth.mockReturnValue(createAuthMock({ healthOk: false, healthError: leaked }));
      const { getByText, queryByText } = render(<OfflineBanner />);
      expect(getByText('Unable to connect to server')).toBeTruthy();
      expect(queryByText(leaked, { exact: false })).toBeNull();
    }
  });
});
