/**
 * Render smoke test for the react-query-migrated Messages screen
 * (app/messages.tsx). Verifies the inbox query mounts, messages group into
 * conversations, and the other participant's row renders.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

jest.mock('expo-image', () => require('@/test-utils/screenMocks').expoImageMock());
jest.mock('expo-linear-gradient', () =>
  require('@/test-utils/screenMocks').expoLinearGradientMock()
);
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

const mockMessageList = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Message: { list: (...args: any[]) => mockMessageList(...args) },
  User: {
    following: jest.fn().mockResolvedValue({ items: [] }),
    searchForMentions: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    checkAuth: jest.fn().mockResolvedValue({ id: 'u1' }),
  }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/utils/authState', () => ({
  getAuthSnapshot: jest.fn().mockResolvedValue({ id: 'u1', display_name: 'Me' }),
}));

import MessagesScreen from '../messages';
import { QueryWrapper } from '../../test-utils/screenMocks';

const sampleMessage = {
  id: 'msg1',
  conversation_id: 'c1',
  sender_id: 'u2',
  recipient_id: 'u1',
  content: 'See you at the game!',
  created_at: new Date().toISOString(),
  sender: { id: 'u2', display_name: 'Alex Coach', username: 'alexc' },
  recipient: { id: 'u1', display_name: 'Me' },
  read: false,
};

beforeEach(() => {
  mockMessageList.mockReset().mockResolvedValue([sampleMessage]);
});

describe('MessagesScreen (react-query render smoke)', () => {
  it('mounts, runs the inbox query, and renders a conversation row', async () => {
    render(
      <QueryWrapper>
        <MessagesScreen />
      </QueryWrapper>
    );
    await waitFor(() => expect(mockMessageList).toHaveBeenCalledWith('-created_at', 50));
    expect(await screen.findByText('@alexc')).toBeTruthy();
    expect(screen.getByText('See you at the game!')).toBeTruthy();
  });
});
