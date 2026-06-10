import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockUseAuth = jest.fn();

jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

import { useUser, useUserProfile } from '@/hooks/useUser';

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe('useUser', () => {
  it('reuses AuthProvider user instead of creating a second local /me snapshot', () => {
    const authUser = { id: 'user-1', email: 'coach@example.com' };
    const checkAuth = jest.fn();
    mockUseAuth.mockReturnValue({
      user: authUser,
      loading: false,
      checkAuth,
    });

    const { result } = renderHook(() => useUser(true));

    expect(result.current.user).toBe(authUser);
    expect(result.current.loading).toBe(false);
    expect(checkAuth).not.toHaveBeenCalled();
  });

  it('refresh reuses the AuthProvider snapshot when one exists', async () => {
    // useUser now delegates to getAuthSnapshot: an existing snapshot is
    // returned as-is; AuthProvider owns actual refresh policy.
    const checkAuth: any = jest.fn<(...args: any[]) => Promise<any>>();
    mockUseAuth.mockReturnValue({
      user: { id: 'stale-user' },
      loading: false,
      checkAuth,
    });

    const { result } = renderHook(() => useUser(false));

    let refreshed: any;
    await act(async () => {
      refreshed = await result.current.refresh();
    });
    expect(refreshed).toEqual({ id: 'stale-user' });
    expect(checkAuth).not.toHaveBeenCalled();
  });

  it('auto-loads through AuthProvider when no user snapshot exists', async () => {
    const refreshedUser = { id: 'user-3' };
    const checkAuth: any = jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue(refreshedUser);
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      checkAuth,
    });

    renderHook(() => useUser(true));

    await waitFor(() => {
      expect(checkAuth).toHaveBeenCalledWith();
    });
  });
});

describe('useUserProfile', () => {
  it('derives display fields from the canonical auth snapshot', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-4',
        display_name: 'Varsity',
        email: 'varsity@example.com',
        avatar_url: 'https://example.com/a.png',
        preferences: { zip_code: '10001' },
      },
      loading: false,
      checkAuth: jest.fn(),
    });

    const { result } = renderHook(() => useUserProfile(false));

    expect(result.current.displayName).toBe('Varsity');
    expect(result.current.email).toBe('varsity@example.com');
    expect(result.current.avatarUrl).toBe('https://example.com/a.png');
    expect(result.current.zipCode).toBe('10001');
  });
});
