import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockCacheDel = jest.fn(async () => undefined);
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();

jest.unstable_mockModule('../lib/cache.js', () => ({
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => undefined),
  cacheDel: mockCacheDel,
}));

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    organizationMembership: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.unstable_mockModule('../lib/email.js', () => ({
  sendPasswordResetEmail: jest.fn(async () => true),
  sendVerificationEmail: jest.fn(async () => true),
  sendEmail: jest.fn(async () => true),
}));

jest.unstable_mockModule('../lib/sentry.js', () => ({
  captureException: jest.fn(),
}));

jest.unstable_mockModule('../lib/privacyUtils.js', () => ({
  invalidatePrivateIdsCache: jest.fn(),
}));

jest.unstable_mockModule('../middleware/rateLimiters.js', () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return {
    authLimiter: pass,
    oauthLimiter: pass,
    passwordResetLimiter: pass,
    verificationConfirmLimiter: pass,
  };
});

const { authRouter } = await import('../routes/auth.js');
const { hashRefreshToken } = await import('../lib/jwt.js');

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: 'user-1' };
  next();
});
app.use('/auth', authRouter);

describe('auth /me cache invalidation', () => {
  beforeEach(() => {
    mockCacheDel.mockClear();
    mockUserFindUnique.mockReset();
    mockUserUpdate.mockReset();
  });

  it('clears cached /me after email verification succeeds', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email_verified: false,
      email_verification_code: hashRefreshToken('123456'),
      email_verification_expires: new Date(Date.now() + 60_000),
    });
    mockUserUpdate.mockResolvedValue({
      id: 'user-1',
      email_verified: true,
    });

    await request(app).post('/auth/verify/confirm').send({ code: '123456' }).expect(200);

    expect(mockCacheDel).toHaveBeenCalledWith('me:user-1');
    expect(mockUserUpdate).toHaveBeenCalled();
  });
});
