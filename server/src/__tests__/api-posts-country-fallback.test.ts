/**
 * Reapplied from stranded commit 671d87d3 (never merged — PR #90).
 * A reverseGeocode/geocodeZip failure must not null country_code:
 * null country_code silently drops the post from country-scoped Highlights.
 */
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

jest.unstable_mockModule('../lib/geo.js', () => ({
  reverseGeocode: jest.fn<any>().mockRejectedValue(new Error('geocode down')),
  geocodeZip: jest.fn<any>().mockRejectedValue(new Error('geocode down')),
  getCountryFromReqOrPrefs: jest.fn((_req: any, prefs: any) => prefs?.country_code || prefs?.country || null),
}));

import request from 'supertest';
import bcrypt from 'bcrypt';

let app: any, prisma: any, signJwt: any;
let userId: string;
let postId: string | null = null;

beforeAll(async () => {
  ({ app } = await import('../testApp.js'));
  ({ prisma } = await import('../lib/prisma.js'));
  ({ signJwt } = await import('../lib/jwt.js'));
  const hash = await bcrypt.hash('TestPassword123!', 10);
  const user = await prisma.user.create({
    data: {
      email: `country-fb-${Date.now()}@test.com`,
      password_hash: hash,
      display_name: 'Country Fallback',
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      preferences: { role: 'fan', onboarding_completed: true, country_code: 'US' },
    },
  });
  userId = user.id;
});

afterAll(async () => {
  if (postId) await prisma.post.deleteMany({ where: { id: postId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

it('falls back to preference country when reverse geocoding fails', async () => {
  const token = signJwt({ id: userId });
  const res = await request(app)
    .post('/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      content: 'geocode-down post',
      media_url: 'https://res.cloudinary.com/test/image/upload/x.jpg',
      location: { lat: 40.7, lng: -74.0 },
    });
  expect(res.status).toBeLessThan(300);
  postId = res.body?.id ?? res.body?.post?.id ?? null;
  expect(postId).toBeTruthy();
  const row = await prisma.post.findUnique({
    where: { id: postId! },
    select: { country_code: true },
  });
  expect(row?.country_code).toBe('US');
});
