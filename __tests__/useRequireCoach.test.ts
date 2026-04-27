/**
 * useRequireCoach — admin-override regression test
 *
 * Bug: an admin (is_admin=true) whose User row had dirty coach state
 * (role='coach' + approval_status in {PENDING, REJECTED}) was redirected
 * to /onboarding/pending-approval whenever they hit any of the 8 tabs
 * gated by this hook (event-approvals, approvals, manage-teams,
 * team-contacts, my-team, team-hub, create-team, edit-team) — reopening
 * the same sign-in loop that commit 7c875eb6 patched in the post-auth
 * route decision. The hook is a third routing path missed in that pass.
 *
 * These tests pin: admins with dirty coach state route to /(tabs), not
 * to pending-approval; non-admin pending/rejected coaches still route to
 * pending-approval (existing behavior preserved).
 */

import { renderHook } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUseAuth = jest.fn();
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

import { useRequireCoach } from '@/hooks/useRequireCoach';

beforeEach(() => {
  mockReplace.mockReset();
  mockUseAuth.mockReset();
});

describe('useRequireCoach — admin override (commit follow-up to 7c875eb6)', () => {
  it('admin with REJECTED coach state routes to /(tabs), not pending-approval', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      user: {
        id: 'admin-1',
        is_admin: true,
        role: 'coach',
        approval_status: 'REJECTED',
        preferences: { role: 'coach', proceeding_as_fan: false },
      },
    });

    renderHook(() => useRequireCoach());

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('admin with PENDING coach state routes to /(tabs), not pending-approval', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      user: {
        id: 'admin-2',
        is_admin: true,
        role: 'coach',
        approval_status: 'PENDING',
        preferences: { role: 'coach', proceeding_as_fan: false },
      },
    });

    renderHook(() => useRequireCoach());

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('non-admin REJECTED coach still routes to pending-approval (behavior preserved)', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      user: {
        id: 'user-1',
        is_admin: false,
        role: 'coach',
        approval_status: 'REJECTED',
        preferences: { role: 'coach', proceeding_as_fan: false },
      },
    });

    renderHook(() => useRequireCoach());

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace.mock.calls[0][0]).toMatch(/pending-approval$/);
  });

  it('non-admin PENDING coach still routes to pending-approval (behavior preserved)', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      user: {
        id: 'user-2',
        is_admin: false,
        role: 'coach',
        approval_status: 'PENDING',
        preferences: { role: 'coach', proceeding_as_fan: false },
      },
    });

    renderHook(() => useRequireCoach());

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace.mock.calls[0][0]).toMatch(/pending-approval$/);
  });

  it('approved coach with current agreement is not redirected', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      user: {
        id: 'coach-1',
        is_admin: false,
        role: 'coach',
        approval_status: 'APPROVED',
        required_coach_agreement_version: 1,
        preferences: {
          role: 'coach',
          coach_agreement_accepted_at: '2025-01-01T00:00:00Z',
          coach_agreement_version: 1,
        },
      },
    });

    renderHook(() => useRequireCoach());

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
