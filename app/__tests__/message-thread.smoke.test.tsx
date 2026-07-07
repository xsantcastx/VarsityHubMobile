import { render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

jest.mock('expo-image', () => require('@/test-utils/screenMocks').expoImageMock());
jest.mock('react-native-safe-area-context', () =>
  require('@/test-utils/screenMocks').safeAreaMock()
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('@/test-utils/screenMocks').reactNavigationOverrides(),
  useIsFocused: () => false,
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  ...require('@/test-utils/screenMocks').expoRouterOverrides(),
  useLocalSearchParams: () => ({ conversation_id: 'c1' }),
}));
jest.mock('@/components/SwipeBackContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/hooks/useConversationSocket', () => ({
  useConversationSocket: jest.fn(),
}));
jest.mock('@/utils/dmRestrictions', () => ({
  checkDMRestriction: jest.fn(() => ({ allowed: true, showWarning: false })),
}));
jest.mock('@/utils/roleChecks', () => ({
  getCoachAccessState: jest.fn(() => ({
    isCoach: false,
    isApprovedCoach: false,
  })),
}));

const mockThreadByConversation = jest.fn();
const mockMarkReadByConversation = jest.fn();
const mockCheckAuth = jest.fn().mockResolvedValue({ id: 'u1' });
const mockAuthedUser = { id: 'u1' };

jest.mock('@/api/entities', () => ({
  __esModule: true,
  Message: {
    threadByConversation: (...args: any[]) => mockThreadByConversation(...args),
    markReadByConversation: (...args: any[]) => mockMarkReadByConversation(...args),
    send: jest.fn(),
  },
  User: {
    block: jest.fn(),
  },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    user: mockAuthedUser,
    checkAuth: mockCheckAuth,
  }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'dark' }));
jest.mock('@/utils/authState', () => ({
  getAuthSnapshot: jest.fn().mockResolvedValue({
    id: 'u1',
    display_name: 'Me',
    avatar_url: null,
  }),
}));

import MessageThreadScreen from '../message-thread';

const sampleMessage = {
  id: 'm1',
  conversation_id: 'c1',
  sender_id: 'u2',
  recipient_id: 'u1',
  content: 'See you at the game!',
  created_at: '2026-07-06T16:08:00.000Z',
  sender: {
    id: 'u2',
    display_name: 'Alex Coach',
    username: 'alexc',
  },
  recipient: {
    id: 'u1',
    display_name: 'Me',
  },
};

beforeEach(() => {
  mockThreadByConversation.mockReset().mockResolvedValue([sampleMessage]);
  mockMarkReadByConversation.mockReset().mockResolvedValue(undefined);
});

describe('MessageThreadScreen', () => {
  it('loads the thread and renders the conversation header and bubble', async () => {
    render(<MessageThreadScreen />);

    await waitFor(() => expect(mockThreadByConversation).toHaveBeenCalledWith('c1', 100));
    await waitFor(() => expect(mockMarkReadByConversation).toHaveBeenCalledWith('c1'));

    expect(await screen.findByText('Alex Coach')).toBeTruthy();
    expect(screen.getByText('Tap to view profile')).toBeTruthy();
    expect(await screen.findByText('See you at the game!')).toBeTruthy();
    expect(await screen.findByText('Jul 6')).toBeTruthy();
  });
});
