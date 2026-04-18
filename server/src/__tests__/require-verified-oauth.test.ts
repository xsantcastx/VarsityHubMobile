import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCacheDel = jest.fn(async () => undefined);
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();

jest.unstable_mockModule('../lib/cache.js', () => ({
  cacheDel: mockCacheDel,
}));

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
  },
}));

const { requireVerified } = await import('../middleware/requireVerified.js');

describe('requireVerified OAuth healing', () => {
  beforeEach(() => {
    mockCacheDel.mockClear();
    mockUserFindUnique.mockReset();
    mockUserUpdate.mockReset();
  });

  it('auto-verifies OAuth-linked users instead of returning 403', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      email_verified: false,
      apple_id: 'apple-123',
      google_id: null,
    });
    mockUserUpdate.mockResolvedValueOnce({
      id: 'user-1',
      email_verified: true,
      apple_id: 'apple-123',
      google_id: null,
    });

    const req = {
      user: { id: 'user-1' },
      baseUrl: '/ads',
      method: 'POST',
      path: '/',
      body: {},
    } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();

    await requireVerified(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        email_verified: true,
        email_verification_code: null,
        email_verification_expires: null,
      },
    });
    expect(mockCacheDel).toHaveBeenCalledWith('me:user-1');
  });
});
