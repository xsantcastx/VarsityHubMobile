/**
 * Render smoke test for the react-query-migrated Favorites screen.
 * Verifies the useInfiniteQuery wiring mounts and renders a tree (loading →
 * empty) without crashing, via the shared harness + a test QueryClient.
 */
import { render, waitFor } from '@testing-library/react-native';

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

jest.mock('expo-image', () => require('@/test-utils/screenMocks').expoImageMock());
jest.mock('react-native-safe-area-context', () =>
  require('@/test-utils/screenMocks').safeAreaMock()
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('@/test-utils/screenMocks').reactNavigationOverrides(),
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
}));

const mockInteractions = jest.fn().mockResolvedValue({ items: [], nextCursor: null });
jest.mock('@/api/entities', () => ({
  __esModule: true,
  User: { interactionsForProfile: (...args: any[]) => mockInteractions(...args) },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' }, checkAuth: jest.fn().mockResolvedValue({ id: 'u1' }) }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));

import FavoritesScreen from '../favorites';
import { QueryWrapper } from '../../test-utils/screenMocks';

describe('FavoritesScreen (react-query render smoke)', () => {
  it('mounts, runs the infinite query, and renders a tree', async () => {
    const { toJSON } = render(
      <QueryWrapper>
        <FavoritesScreen />
      </QueryWrapper>
    );
    expect(toJSON()).toBeTruthy();
    // The query fires once userId resolves from the auth snapshot.
    await waitFor(() => expect(mockInteractions).toHaveBeenCalled());
    expect(mockInteractions).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ type: 'save', limit: 20, sort: 'newest' })
    );
  });
});
