/**
 * Regression: replacing a profile photo must destroy the prior avatar object in
 * WHICHEVER backend hosts it.
 *
 * The bug: handleUpdateMe gated cleanup on
 * `priorAvatarUrl.includes('res.cloudinary.com')`. Once the R2 media migration
 * went live (2026-07-13) new avatars upload to R2, so that gate matched nothing
 * and every replaced avatar orphaned in the bucket forever.
 *
 * These drive the real PUT /me handler with the storage backends mocked, so the
 * assertions are about what the route actually does, not about its source text.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const R2_BASE = 'https://pub-61f12b49067c403ca5f56fa57105b3ed.r2.dev';
process.env.R2_PUBLIC_BASE_URL = R2_BASE;

const CURRENT_USER = { id: 'user-1' };

const mockUserFindUnique = jest.fn<any>();
const mockUserUpdate = jest.fn<any>();
const mockUserFindFirst = jest.fn<any>(async () => null);

const mockDestroyCloudinaryAsset = jest.fn<any>(async () => ({ ok: true }));
const mockDeleteR2ObjectByUrl = jest.fn<any>(async () => true);

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      findFirst: mockUserFindFirst,
      update: mockUserUpdate,
    },
    $executeRaw: jest.fn<any>(async () => 0),
  },
}));

// Keep the real extractCloudinaryPublicId — the host gate is exactly what keeps
// Google/Apple CDN avatars from being treated as ours — but stub the destroy.
const realCloudinary = await import('../lib/cloudinary.js');
jest.unstable_mockModule('../lib/cloudinary.js', () => ({
  ...realCloudinary,
  destroyCloudinaryAsset: mockDestroyCloudinaryAsset,
}));

// Same for R2: real extractR2Key, stubbed delete.
const realR2 = await import('../lib/r2.js');
jest.unstable_mockModule('../lib/r2.js', () => ({
  ...realR2,
  deleteR2ObjectByUrl: mockDeleteR2ObjectByUrl,
}));

jest.unstable_mockModule('../middleware/requireAuth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = CURRENT_USER;
    next();
  },
}));
jest.unstable_mockModule('../middleware/requireVerified.js', () => ({
  requireVerified: (_req: any, _res: any, next: any) => next(),
}));

const { authRouter } = await import('../routes/auth.js');

const app = express();
app.use(express.json());
app.use(authRouter);

/** Replace the avatar and wait for the fire-and-forget cleanup to settle. */
async function replaceAvatarFrom(priorAvatarUrl: string | null) {
  mockUserFindUnique.mockResolvedValue({ id: 'user-1', avatar_url: priorAvatarUrl });
  mockUserUpdate.mockResolvedValue({ id: 'user-1', avatar_url: `${R2_BASE}/new.jpg` });

  const res = await request(app)
    .put('/me')
    .send({ avatar_url: `${R2_BASE}/new.jpg` });

  // Cleanup is deliberately not awaited by the handler; let its microtasks run.
  await new Promise(resolve => setImmediate(resolve));
  return res;
}

describe('avatar replacement cleans up the prior object in either backend', () => {
  beforeEach(() => {
    mockDestroyCloudinaryAsset.mockClear();
    mockDeleteR2ObjectByUrl.mockClear();
    mockUserFindUnique.mockReset();
    mockUserUpdate.mockReset();
  });

  it('deletes the prior R2 object when the old avatar was on R2 (the regression)', async () => {
    const res = await replaceAvatarFrom(`${R2_BASE}/varsityhub/production/old.jpg`);

    expect(res.status).toBe(200);
    expect(mockDeleteR2ObjectByUrl).toHaveBeenCalledWith(
      `${R2_BASE}/varsityhub/production/old.jpg`
    );
    expect(mockDestroyCloudinaryAsset).not.toHaveBeenCalled();
  });

  it('still destroys the prior Cloudinary asset when the old avatar was on Cloudinary', async () => {
    const res = await replaceAvatarFrom(
      'https://res.cloudinary.com/demo/image/upload/v1/varsityhub/production/old.jpg'
    );

    expect(res.status).toBe(200);
    // publicId is extension-stripped by extractCloudinaryPublicId.
    expect(mockDestroyCloudinaryAsset).toHaveBeenCalledWith('varsityhub/production/old', 'image');
    expect(mockDeleteR2ObjectByUrl).not.toHaveBeenCalled();
  });

  it('never destroys a Google OAuth CDN avatar — we do not own that object', async () => {
    const GOOGLE_AVATAR = 'https://lh3.googleusercontent.com/a/ACg8ocK-old=s96-c';
    const res = await replaceAvatarFrom(GOOGLE_AVATAR);

    expect(res.status).toBe(200);
    expect(mockDestroyCloudinaryAsset).not.toHaveBeenCalled();
    // The handler does hand foreign URLs to deleteR2ObjectByUrl, which is safe
    // only because that helper is gated on the R2_PUBLIC_BASE_URL prefix. Pin
    // that gate with the REAL extractR2Key: no key means no DeleteObject call.
    expect(realR2.extractR2Key(GOOGLE_AVATAR)).toBeNull();
  });

  it('deletes nothing when the avatar is unchanged', async () => {
    const unchanged = `${R2_BASE}/new.jpg`;
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', avatar_url: unchanged });
    mockUserUpdate.mockResolvedValue({ id: 'user-1', avatar_url: unchanged });

    const res = await request(app).put('/me').send({ avatar_url: unchanged });
    await new Promise(resolve => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(mockDestroyCloudinaryAsset).not.toHaveBeenCalled();
    expect(mockDeleteR2ObjectByUrl).not.toHaveBeenCalled();
  });

  it('a storage failure never fails the request — cleanup is fire-and-forget', async () => {
    mockDeleteR2ObjectByUrl.mockRejectedValueOnce(new Error('R2 unreachable'));

    const res = await replaceAvatarFrom(`${R2_BASE}/varsityhub/production/old.jpg`);

    expect(res.status).toBe(200);
  });
});
