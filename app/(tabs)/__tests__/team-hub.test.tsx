/**
 * Render smoke test for the Team Hub redirect/gate screen.
 *
 * team-hub is a coach-only entry point: it shows a spinner while resolving,
 * blocks non-coaches with CoachAccessRedirecting, and otherwise redirects to
 * the org overview, the first managed team, or the tab root. A regression here
 * either strands coaches on a spinner or leaks the coach tool to non-coaches —
 * both are user-facing breakages tsc cannot see.
 */
import { ActivityIndicator } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

// ── Controllable mock state (jest-hoisted: names must start with `mock`) ──
let mockRequireCoach: { canAccessCoachTools: boolean; loading: boolean } = {
  canAccessCoachTools: false,
  loading: true,
};
let mockUser: any = null;
let mockManagedTeams: any[] = [];
let mockRedirectedTo: string | null = null;

jest.mock('@/hooks/useRequireCoach', () => ({
  useRequireCoach: () => mockRequireCoach,
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/api/entities', () => ({
  Team: { managed: jest.fn(() => Promise.resolve(mockManagedTeams)) },
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
  Redirect: ({ href }: any) => {
    mockRedirectedTo = String(href);
    return null;
  },
  useRootNavigationState: () => ({ key: 'root-key' }),
}));

import TeamHubRedirectScreen from '../team-hub';

beforeEach(() => {
  mockRequireCoach = { canAccessCoachTools: false, loading: true };
  mockUser = null;
  mockManagedTeams = [];
  mockRedirectedTo = null;
});

describe('TeamHubRedirectScreen', () => {
  it('shows a spinner while coach access is resolving (loading state)', () => {
    mockRequireCoach = { canAccessCoachTools: false, loading: true };
    const { UNSAFE_getAllByType, queryByText } = render(<TeamHubRedirectScreen />);
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    expect(queryByText('coach-access-redirecting')).toBeNull();
    expect(mockRedirectedTo).toBeNull();
  });

  it('blocks a non-coach with the coach-access gate (does not leak the tool)', () => {
    mockRequireCoach = { canAccessCoachTools: false, loading: false };
    const { getByText } = render(<TeamHubRedirectScreen />);
    expect(getByText('coach-access-redirecting')).toBeTruthy();
    expect(mockRedirectedTo).toBeNull();
  });

  it('redirects a coach with an organization to the org overview', async () => {
    mockRequireCoach = { canAccessCoachTools: true, loading: false };
    mockUser = { organization_id: 'org-1' };
    render(<TeamHubRedirectScreen />);
    await waitFor(() => expect(mockRedirectedTo).toBe('/organization?id=org-1&tab=overview'));
  });

  it('redirects an org-less coach to their first managed team', async () => {
    mockRequireCoach = { canAccessCoachTools: true, loading: false };
    mockUser = { id: 'coach-1' };
    mockManagedTeams = [{ id: 'team-9' }];
    render(<TeamHubRedirectScreen />);
    await waitFor(() => expect(mockRedirectedTo).toBe('/team-admin?teamId=team-9&tab=overview'));
  });

  it('falls back to the tab root when a coach manages no teams', async () => {
    mockRequireCoach = { canAccessCoachTools: true, loading: false };
    mockUser = { id: 'coach-1' };
    mockManagedTeams = [];
    render(<TeamHubRedirectScreen />);
    await waitFor(() => expect(mockRedirectedTo).toBe('/(tabs)'));
  });
});
