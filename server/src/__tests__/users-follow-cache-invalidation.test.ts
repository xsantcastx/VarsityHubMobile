import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockInvalidateMeCacheForUser = jest.fn(async () => undefined);
const mockBlockedUserFindFirst = jest.fn(async () => null);
const mockBlockedUserCreate = jest.fn(async () => ({ id: 'block-1' }));
const mockBlockedUserDeleteMany = jest.fn(async () => ({ count: 1 }));
const mockFollowsFindUnique = jest.fn(async () => null);
const mockFollowsCreate = jest.fn(async () => ({ status: 'accepted' }));
const mockFollowsDeleteMany = jest.fn(async () => ({ count: 1 }));
const mockFollowsUpdate = jest.fn(async () => ({ status: 'accepted' }));
const mockUserFindUnique = jest.fn(async () => ({ preferences: {}, display_name: 'User' }));
const mockNotificationCreate = jest.fn(async () => ({ id: 'notif-1' }));
const mockNotifyNewFollower = jest.fn(async () => undefined);
const mockSendPushNotification = jest.fn(async () => undefined);
const TARGET_USER_ID = 'c123456789012345678901235';

jest.unstable_mockModule('../lib/userCache.js', () => ({
  invalidateMeCacheForUser: mockInvalidateMeCacheForUser,
  updateUserAndInvalidate: jest.fn(),
}));

jest.unstable_mockModule('../lib/prisma.js', () => {
  // Self-referential mock so $transaction can pass `tx` (which mirrors the
  // prisma shape) to its callback. The follow route's transactional
  // re-check of BlockedUser uses tx.blockedUser.findFirst + tx.follows.create.
  const prismaMock: any = {};
  Object.assign(prismaMock, {
    $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
    user: {
      findUnique: mockUserFindUnique,
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      count: jest.fn(async () => 0),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    follows: {
      findUnique: mockFollowsFindUnique,
      create: mockFollowsCreate,
      deleteMany: mockFollowsDeleteMany,
      update: mockFollowsUpdate,
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
    },
    blockedUser: {
      findFirst: mockBlockedUserFindFirst,
      create: mockBlockedUserCreate,
      deleteMany: mockBlockedUserDeleteMany,
      findMany: jest.fn(async () => []),
    },
    notification: {
      create: mockNotificationCreate,
    },
    post: {
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
    },
    organizationMembership: {
      findMany: jest.fn(async () => []),
    },
    teamMembership: {
      findMany: jest.fn(async () => []),
    },
  });
  return { prisma: prismaMock };
});

jest.unstable_mockModule('../lib/notifications.js', () => ({
  notifyNewFollower: mockNotifyNewFollower,
  sendPushNotification: mockSendPushNotification,
}));

jest.unstable_mockModule('../middleware/requireAuth.js', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.unstable_mockModule('../middleware/requireVerified.js', () => ({
  requireVerified: (_req: any, _res: any, next: any) => next(),
}));

jest.unstable_mockModule('../middleware/requireAdmin.js', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  getIsAdmin: jest.fn(async () => false),
  isVerifiedAdminUser: jest.fn(async () => false),
}));

jest.unstable_mockModule('../middleware/rateLimiters.js', () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return {
    followLimiter: pass,
    mentionsSearchLimiter: pass,
    userLookupLimiter: pass,
    usernameAvailableLimiter: pass,
  };
});

const { usersRouter } = await import('../routes/users.js');

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: 'c123456789012345678901234' };
  next();
});
app.use('/users', usersRouter);

describe('users follow cache invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({ preferences: {}, display_name: 'User' });
    mockBlockedUserFindFirst.mockResolvedValue(null);
    mockFollowsFindUnique.mockResolvedValue(null);
    mockFollowsCreate.mockResolvedValue({ status: 'accepted' });
    mockFollowsDeleteMany.mockResolvedValue({ count: 1 });
    mockFollowsUpdate.mockResolvedValue({ status: 'accepted' });
    mockBlockedUserCreate.mockResolvedValue({ id: 'block-1' });
    mockBlockedUserDeleteMany.mockResolvedValue({ count: 1 });
  });

  it('invalidates both me caches after following a user', async () => {
    await request(app).post(`/users/${TARGET_USER_ID}/follow`).expect(201);

    expect(mockInvalidateMeCacheForUser).toHaveBeenCalledWith('c123456789012345678901234');
    expect(mockInvalidateMeCacheForUser).toHaveBeenCalledWith(TARGET_USER_ID);
  });

  it('invalidates both me caches after unfollowing a user', async () => {
    await request(app).delete(`/users/${TARGET_USER_ID}/follow`).expect(200);

    expect(mockInvalidateMeCacheForUser).toHaveBeenCalledWith('c123456789012345678901234');
    expect(mockInvalidateMeCacheForUser).toHaveBeenCalledWith(TARGET_USER_ID);
  });

  it('invalidates both me caches after blocking a user removes follow edges', async () => {
    await request(app).post(`/users/${TARGET_USER_ID}/block`).expect(201);

    expect(mockInvalidateMeCacheForUser).toHaveBeenCalledWith('c123456789012345678901234');
    expect(mockInvalidateMeCacheForUser).toHaveBeenCalledWith(TARGET_USER_ID);
    expect(mockFollowsDeleteMany).toHaveBeenCalled();
  });
});
