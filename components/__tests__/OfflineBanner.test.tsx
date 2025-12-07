import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '@/context/AuthProvider';
import { OfflineBanner } from '../OfflineBanner';

jest.mock('@/context/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('OfflineBanner', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when API health is OK', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      pendingVerificationEmail: null,
      loading: false,
      isAdmin: false,
      healthOk: true,
      healthError: null,
      checkAuth: jest.fn(),
      signOut: jest.fn(),
      registerPushToken: jest.fn(),
    });

    const { toJSON } = render(<OfflineBanner />);
    expect(toJSON()).toBeNull();
  });

  it('shows error banner and retries authentication when pressed', async () => {
    const checkAuth = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      user: null,
      pendingVerificationEmail: null,
      loading: false,
      isAdmin: false,
      healthOk: false,
      healthError: 'API unreachable',
      checkAuth,
      signOut: jest.fn(),
      registerPushToken: jest.fn(),
    });

    const { getByText } = render(<OfflineBanner />);

    expect(getByText('API unreachable')).toBeTruthy();

    fireEvent.press(getByText('Retry'));

    await waitFor(() => {
      expect(checkAuth).toHaveBeenCalledTimes(1);
    });
  });
});
