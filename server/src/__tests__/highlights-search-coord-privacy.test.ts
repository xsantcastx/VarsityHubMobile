/**
 * Precise-coordinate privacy guard for /highlights and /search.
 *
 * A post's capture lat/lng is selected server-side for radius ranking
 * (highlightPostSelect), but it exposes where a user — often a minor — was
 * filmed and must NEVER reach a client. The stripping lives in a different file
 * (withMediaPreview) from the select, so a surface that reuses the select but
 * forgets to serialize would leak. These tests fail closed if either surface
 * ever ships raw coordinates. The coarse country_code is allowed through.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;

const PASSWORD = 'TestPassword123!';
const TAG = `coordpriv-${Date.now()}`;

describe('/highlights and /search never expose precise post coordinates', () => {
  let authorId: string;
  let postId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    const hash = await bcrypt.hash(PASSWORD, 10);
    const author = await prisma.user.create({
      data: {
        email: `${TAG}@test.com`,
        password_hash: hash,
        display_name: 'Coord Priv Author',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    authorId = author.id;
    const post = await prisma.post.create({
      data: {
        author_id: authorId,
        content: `${TAG} highlight`,
        title: `${TAG} highlight`,
        media_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        country_code: 'US',
        lat: 40.7128,
        lng: -74.006,
      },
    });
    postId = post.id;
  });

  afterAll(async () => {
    if (postId) await prisma.post.deleteMany({ where: { id: postId } });
    if (authorId) await prisma.user.deleteMany({ where: { id: authorId } });
  });

  const assertNoCoords = (items: any[]) => {
    const mine = items.filter(p => String(p.id) === String(postId));
    expect(mine.length).toBeGreaterThan(0); // sanity: our post is actually in the payload
    for (const p of mine) {
      expect(p.lat).toBeUndefined();
      expect(p.lng).toBeUndefined();
      // Coarse location is allowed and expected (drives the card's flag).
      expect(p.country_code).toBe('US');
    }
  };

  it('GET /highlights (recent) strips lat/lng', async () => {
    const res = await request(app)
      .get('/highlights?v2=1&sort=recent&country=US&limit=100')
      .expect(200);
    const items = Array.isArray(res.body?.items) ? res.body.items : [];
    assertNoCoords(items);
  });

  it('GET /search strips lat/lng from post results', async () => {
    const res = await request(app)
      .get(`/search?q=${encodeURIComponent(TAG)}`)
      .expect(200);
    const posts = Array.isArray(res.body?.posts) ? res.body.posts : [];
    assertNoCoords(posts);
  });
});
