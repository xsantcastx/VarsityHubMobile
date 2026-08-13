/**
 * Render smoke test for the Team Hub screen.
 *
 * team-hub is a coach-only entry point: it shows a spinner while resolving,
 * blocks non-coaches with CoachAccessRedirecting, and — once a coach is
 * admitted — renders the needs-action queue (`User.actionQueue()`) instead of
 * redirecting away. A regression here either strands coaches on a spinner,
 * leaks the coach tool to non-coaches, or breaks the queue render.
 */
import { ActivityIndicator } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { QueryWrapper } from '../../../test-utils/screenMocks';

// ── Controllable mock state (jest-hoisted: names must start with `mock`) ──
let mockRequireManagement: { canManage: boolean; loading: boolean } = {
  canManage: false,
  loading: true,
};
let mockUser: any = null;
let mockActionQueue: any = { total: 0, counts: { events: 0, games: 0, requests: 0 }, items: [] };
const mockActionQueueFn = jest.fn((..._args: any[]) => Promise.resolve(mockActionQueue));
const mockPush = jest.fn();

jest.mock('@/hooks/useRequireTeamManagement', () => ({
  useRequireTeamManagement: () => mockRequireManagement,
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/api/entities', () => ({
  User: { actionQueue: (...args: any[]) => mockActionQueueFn(...args) },
}));
jest.mock('@/components/CoachAccessRedirecting', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(Text, null, 'coach-access-redirecting'),
  };
});
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush }),
}));

import TeamHubScreen from '../team-hub';

beforeEach(() => {
  mockRequireManagement = { canManage: false, loading: true };
  mockUser = null;
  mockActionQueue = { total: 0, counts: { events: 0, games: 0, requests: 0 }, items: [] };
  mockActionQueueFn.mockClear();
  mockPush.mockClear();
});

describe('TeamHubScreen', () => {
  it('shows a spinner while coach access is resolving (loading state)', () => {
    mockRequireManagement = { canManage: false, loading: true };
    const { UNSAFE_getAllByType, queryByText } = render(
      <QueryWrapper>
        <TeamHubScreen />
      </QueryWrapper>
    );
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    expect(queryByText('coach-access-redirecting')).toBeNull();
  });

  it('blocks a non-coach with the coach-access gate (does not leak the tool)', () => {
    mockRequireManagement = { canManage: false, loading: false };
    const { getByText } = render(
      <QueryWrapper>
        <TeamHubScreen />
      </QueryWrapper>
    );
    expect(getByText('coach-access-redirecting')).toBeTruthy();
    expect(mockActionQueueFn).not.toHaveBeenCalled();
  });

  it('shows the "all caught up" empty state when the queue is empty', async () => {
    mockRequireManagement = { canManage: true, loading: false };
    mockUser = { id: 'coach-1' };
    mockActionQueue = { total: 0, counts: { events: 0, games: 0, requests: 0 }, items: [] };
    const { findByText } = render(
      <QueryWrapper>
        <TeamHubScreen />
      </QueryWrapper>
    );
    expect(await findByText("You're all caught up")).toBeTruthy();
  });

  it('renders a queue item title when the queue has an item', async () => {
    mockRequireManagement = { canManage: true, loading: false };
    mockUser = { id: 'coach-1' };
    mockActionQueue = {
      total: 1,
      counts: { events: 1, games: 0, requests: 0 },
      items: [
        {
          kind: 'event',
          id: 'evt-1',
          title: 'Approve practice at Main Gym',
          subtitle: 'Requested by Coach Smith',
          team_id: 'team-1',
          org_id: null,
          created_at: '2026-07-01T00:00:00.000Z',
          route: '/event-details?id=evt-1',
        },
      ],
    };
    const { findByText } = render(
      <QueryWrapper>
        <TeamHubScreen />
      </QueryWrapper>
    );
    expect(await findByText('Approve practice at Main Gym')).toBeTruthy();
  });
});
