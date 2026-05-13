import { describe, expect, it, jest } from '@jest/globals';

import { getAuthSnapshot, isApprovedCoach } from '@/utils/authState';

describe('authState helpers', () => {
  it('returns the current user snapshot without calling checkAuth again', async () => {
    const checkAuth = jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'server-user' });
    const localUser = { id: 'local-user' };

    await expect(getAuthSnapshot(checkAuth as any, localUser)).resolves.toEqual(localUser);
    expect(checkAuth).not.toHaveBeenCalled();
  });

  it('falls back to checkAuth when no current user snapshot exists', async () => {
    const serverUser = { id: 'server-user' };
    const checkAuth = jest.fn<() => Promise<any>>().mockResolvedValue(serverUser);

    await expect(getAuthSnapshot(checkAuth as any, null)).resolves.toEqual(serverUser);
    expect(checkAuth).toHaveBeenCalledTimes(1);
  });

  it('detects approved coaches from canonical role + approval status', () => {
    expect(
      isApprovedCoach({
        role: 'coach',
        approval_status: 'APPROVED',
      })
    ).toBe(true);
  });
});
