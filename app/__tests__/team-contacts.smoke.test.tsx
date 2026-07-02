/**
 * Render smoke test for the react-query-migrated Team Chat screen
 * (app/(tabs)/team-contacts.tsx). Verifies the shared team-members query
 * mounts (raw cache + select mapping) and the members tab renders a roster
 * row after the InteractionManager deferral.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

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
  useLocalSearchParams: () => ({ id: 't1' }),
}));
jest.mock('expo-image-picker', () => require('@/test-utils/screenMocks').expoImagePickerMock());
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
}));
// Heavy media children pull in expo-video, which can't load under jest.
jest.mock('@/components/VideoPlayer', () =>
  require('@/test-utils/screenMocks').childSentinelMock('VideoPlayer')()
);
jest.mock('@/components/VideoTrimmer', () =>
  require('@/test-utils/screenMocks').childSentinelMock('VideoTrimmer')()
);

const mockMembers = jest.fn();
jest.mock('@/api/entities', () => ({
  __esModule: true,
  Team: { members: (...args: any[]) => mockMembers(...args) },
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
// Team-management gate: mock as already resolved/allowed.
jest.mock('@/hooks/useRequireTeamManagement', () => ({
  useRequireTeamManagement: () => ({ canManage: true, loading: false }),
}));

import TeamChatScreen from '../(tabs)/team-contacts';
import { QueryWrapper } from '../../test-utils/screenMocks';

const sampleMember = {
  id: 'm1',
  role: 'coach',
  user: {
    id: 'user1',
    display_name: 'Casey Coach',
    email: 'casey@example.com',
    avatar_url: null,
  },
};

beforeEach(() => {
  mockMembers.mockReset().mockResolvedValue([sampleMember]);
});

describe('TeamChatScreen (react-query render smoke)', () => {
  it('mounts, runs the members query after interactions settle, and renders the roster', async () => {
    render(
      <QueryWrapper>
        <TeamChatScreen />
      </QueryWrapper>
    );
    // The members query is gated behind InteractionManager.runAfterInteractions.
    jest.runOnlyPendingTimers();
    await waitFor(() => expect(mockMembers).toHaveBeenCalledWith('t1'));
    // Roster lives on the Members tab.
    fireEvent.press(await screen.findByText(/Members/));
    expect(await screen.findByText('Casey Coach')).toBeTruthy();
  });
});
