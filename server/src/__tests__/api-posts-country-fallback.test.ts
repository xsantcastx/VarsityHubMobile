/**
 * Reapplied from stranded commit 671d87d3 (never merged — PR #90).
 * A reverseGeocode/geocodeZip failure must not null country_code:
 * null country_code silently drops the post from country-scoped Highlights.
 *
 * Real users never have country_code/country written into User.preferences
 * (registration's initialPreferences and onboarding only write zip_code).
 * getCountryFromReqOrPrefs() therefore returns null for every real user, so
 * the posts.ts fallback chain must resolve to 'US' (matching the read-side
 * default in app/highlights.tsx), never null.
 */
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

jest.unstable_mockModule('../lib/geo.js', () => ({
  reverseGeocode: jest.fn<any>().mockRejectedValue(new Error('geocode down')),
  geocodeZip: jest.fn<any>().mockRejectedValue(new Error('geocode down')),
  getCountryFromReqOrPrefs: jest.fn(
    (_req: any, prefs: any) => prefs?.country_code || prefs?.country || null
  ),
}));

import request from 'supertest';
import bcrypt from 'bcrypt';

let app: any, prisma: any, signJwt: any;
let userWithPrefCountryId: string;
let userNoPrefCountryId: string;
let userNoLocationId: string;
const postIds: string[] = [];

beforeAll(async () => {
  ({ app } = await import('../testApp.js'));
  ({ prisma } = await import('../lib/prisma.js'));
  ({ signJwt } = await import('../lib/jwt.js'));
  const hash = await bcrypt.hash('TestPassword123!', 10);

  const userWithPrefCountry = await prisma.user.create({
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
  userWithPrefCountryId = userWithPrefCountry.id;

  // Reflects reality: registration/onboarding never write country_code/country
  // into preferences — only zip_code (and other onboarding fields) get written.
  const userNoPrefCountry = await prisma.user.create({
    data: {
      email: `country-fb-noprefs-${Date.now()}@test.com`,
      password_hash: hash,
      display_name: 'No Pref Country',
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      preferences: { role: 'fan', onboarding_completed: true, zip_code: '90210' },
    },
  });
  userNoPrefCountryId = userNoPrefCountry.id;

  const userNoLocation = await prisma.user.create({
    data: {
      email: `country-fb-nolocation-${Date.now()}@test.com`,
      password_hash: hash,
      display_name: 'No Location At All',
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      preferences: { role: 'fan', onboarding_completed: true },
    },
  });
  userNoLocationId = userNoLocation.id;
});

afterAll(async () => {
  if (postIds.length) await prisma.post.deleteMany({ where: { id: { in: postIds } } });
  await prisma.user
    .deleteMany({
      where: { id: { in: [userWithPrefCountryId, userNoPrefCountryId, userNoLocationId] } },
    })
    .catch(() => {});
});

it('falls back to preference country when reverse geocoding fails', async () => {
  const token = signJwt({ id: userWithPrefCountryId });
  const res = await request(app)
    .post('/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      content: 'geocode-down post',
      media_url: 'https://varsityhub.app/uploads/x.jpg',
      location: { lat: 40.7, lng: -74.0 },
    });
  expect(res.status).toBeLessThan(300);
  const postId = res.body?.id ?? res.body?.post?.id ?? null;
  expect(postId).toBeTruthy();
  postIds.push(postId);
  const row = await prisma.post.findUnique({
    where: { id: postId! },
    select: { country_code: true },
  });
  expect(row?.country_code).toBe('US');
});

it('defaults to US when the user has no preference country and reverse geocoding fails (real-world case: no user ever has prefs.country_code)', async () => {
  const token = signJwt({ id: userNoPrefCountryId });
  const res = await request(app)
    .post('/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      content: 'geocode-down post, no pref country',
      media_url: 'https://varsityhub.app/uploads/x.jpg',
      location: { lat: 34.0, lng: -118.4, source: 'device' },
    });
  expect(res.status).toBeLessThan(300);
  const postId = res.body?.id ?? res.body?.post?.id ?? null;
  expect(postId).toBeTruthy();
  postIds.push(postId);
  const row = await prisma.post.findUnique({
    where: { id: postId! },
    select: { country_code: true },
  });
  expect(row?.country_code).toBe('US');
});

it('defaults to US when the user has no preference country and no location at all (else branch)', async () => {
  const token = signJwt({ id: userNoLocationId });
  const res = await request(app).post('/posts').set('Authorization', `Bearer ${token}`).send({
    content: 'no location at all post',
    media_url: 'https://varsityhub.app/uploads/x.jpg',
  });
  expect(res.status).toBeLessThan(300);
  const postId = res.body?.id ?? res.body?.post?.id ?? null;
  expect(postId).toBeTruthy();
  postIds.push(postId);
  const row = await prisma.post.findUnique({
    where: { id: postId! },
    select: { country_code: true },
  });
  expect(row?.country_code).toBe('US');
});
