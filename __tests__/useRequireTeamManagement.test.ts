/**
 * useRequireTeamManagement — membership-aware guard
 *
 * Pins:
 *   - coaches with tools access are allowed with NO membership fetch
 *   - coach redirect paths (stale agreement) are preserved unchanged
 *   - a fan-role member who manages a team is admitted after the probe
 *   - a fan-role member with nothing to manage is bounced to feed
 *   - non-coach users are NOT redirected until the probe resolves (no flash)
 */

import { renderHook, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUseAuth = jest.fn();
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockManaged = jest.fn();
const mockReviewSummaries = jest.fn();
jest.mock('@/api/entities', () => ({
  Team: { managed: () => mockManaged() },
  Organization: { reviewSummaries: () => mockReviewSummaries() },
}));

const mockCaptureException = jest.fn();
jest.mock('@/utils/sentry', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { useRequireTeamManagement } from '@/hooks/useRequireTeamManagement';

beforeEach(() => {
  mockReplace.mockReset();
  mockUseAuth.mockReset();
  mockManaged.mockReset().mockResolvedValue([]);
  mockReviewSummaries.mockReset().mockResolvedValue([]);
  mockCaptureException.mockReset();
});

const approvedCoachWithTools = {
  id: 'coach-ok',
  role: 'coach',
  approval_status: 'APPROVED',
  organization_id: 'org_1',
  required_coach_agreement_version: 1,
  preferences: {
    role: 'coach',
    onboarding_completed: true,
    coach_agreement_accepted_at: '2026-01-01T00:00:00.000Z',
    coach_agreement_version: 1,
  },
};

describe('useRequireTeamManagement', () => {
  it('allows a coach with tools access without any membership fetch', () => {
    mockUseAuth.mockReturnValue({ loading: false, user: approvedCoachWithTools });

    const { result } = renderHook(() => useRequireTeamManagement());

    expect(result.current.canManage).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(mockManaged).not.toHaveBeenCalled();
    expect(mockReviewSummaries).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('preserves the coach redirect for an approved coach with a stale agreement', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      user: {
        role: 'coach',
        approval_status: 'APPROVED',
        organization_id: 'org_1',
        required_coach_agreement_version: 2,
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          coach_agreement_accepted_at: '2026-01-01T00:00:00.000Z',
          coach_agreement_version: 1,
        },
      },
    });

    renderHook(() => useRequireTeamManagement());

    expect(mockReplace).toHaveBeenCalledWith('/onboarding/coach-agreement');
    expect(mockManaged).not.toHaveBeenCalled();
  });

  it('admits a fan-role member who manages a team after the probe resolves', async () => {
    mockManaged.mockResolvedValue([{ id: 'team_1' }]);
    mockUseAuth.mockReturnValue({
      loading: false,
      user: { id: 'fan-mgr', role: 'fan', preferences: { role: 'fan' } },
    });

    const { result } = renderHook(() => useRequireTeamManagement());

    // Non-coach: blocked from rendering while probing, but NOT redirected yet.
    expect(result.current.loading).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('bounces a fan-role user with nothing to manage to feed after the probe', async () => {
    mockManaged.mockResolvedValue([]);
    mockReviewSummaries.mockResolvedValue([]);
    mockUseAuth.mockReturnValue({
      loading: false,
      user: { id: 'fan-only', role: 'fan', preferences: { role: 'fan' } },
    });

    const { result } = renderHook(() => useRequireTeamManagement());

    expect(result.current.loading).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/feed'));
    expect(result.current.canManage).toBe(false);
  });

  it('admits a fan-role org admin with no managed teams', async () => {
    mockManaged.mockResolvedValue([]);
    mockReviewSummaries.mockResolvedValue([{ organization: { id: 'org_9' } }]);
    mockUseAuth.mockReturnValue({
      loading: false,
      user: { id: 'fan-orgadmin', role: 'fan', preferences: { role: 'fan' } },
    });

    const { result } = renderHook(() => useRequireTeamManagement());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('reuses a recent membership probe for the same user across guarded screens', async () => {
    const user = { id: 'fan-cache-manager', role: 'fan', preferences: { role: 'fan' } };
    mockManaged.mockResolvedValue([{ id: 'team_cache_1' }]);
    mockReviewSummaries.mockResolvedValue([]);
    mockUseAuth.mockReturnValue({ loading: false, user });

    const first = renderHook(() => useRequireTeamManagement());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.canManage).toBe(true);
    expect(mockManaged).toHaveBeenCalledTimes(1);
    expect(mockReviewSummaries).toHaveBeenCalledTimes(1);
    first.unmount();

    mockManaged.mockClear();
    mockReviewSummaries.mockClear();

    const second = renderHook(() => useRequireTeamManagement());
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.canManage).toBe(true);
    expect(mockManaged).not.toHaveBeenCalled();
    expect(mockReviewSummaries).not.toHaveBeenCalled();
  });

  it('fails closed and reports when the membership probe errors', async () => {
    mockManaged.mockRejectedValue(new Error('network down'));
    mockReviewSummaries.mockRejectedValue(new Error('network down'));
    mockUseAuth.mockReturnValue({
      loading: false,
      user: { id: 'fan-flaky', role: 'fan', preferences: { role: 'fan' } },
    });

    const { result } = renderHook(() => useRequireTeamManagement());

    // Probe error -> 0 managed -> bounced (fail-closed), not silently swallowed.
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/feed'));
    expect(result.current.canManage).toBe(false);
    expect(mockCaptureException).toHaveBeenCalledTimes(2);
    expect(mockCaptureException.mock.calls[0][1]).toMatchObject({
      tags: { context: 'team_management_guard_probe' },
    });
  });

  it('bounces an unauthenticated user WITHOUT probing (no API calls, no Sentry noise)', async () => {
    mockUseAuth.mockReturnValue({ loading: false, user: null });

    const { result } = renderHook(() => useRequireTeamManagement());

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/feed'));
    expect(result.current.canManage).toBe(false);
    // No membership probe should fire for a logged-out user — no failing API
    // calls, no captureException noise.
    expect(mockManaged).not.toHaveBeenCalled();
    expect(mockReviewSummaries).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
