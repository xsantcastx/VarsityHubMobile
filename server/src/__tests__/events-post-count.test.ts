/**
 * GET /events?with_post_count=1 — media_post_count for the map's day-scoped view.
 *
 * The map's past-day view hides events nobody posted media to (a dead-end page).
 * That needs the server to report how many media posts each event has. This
 * pins: media posts count, non-media / deleted posts do NOT, and an event with
 * none reports 0 — so the client can drop the zero ones.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;

const TAG = `evpc-${Date.now()}`;

describe('GET /events?with_post_count=1', () => {
  let authorId: string;
  let withMediaId: string;
  let noMediaId: string;
  const postIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    const hash = await bcrypt.hash('TestPassword123!', 10);
    const author = await prisma.user.create({
      data: {
        email: `${TAG}@test.com`,
        password_hash: hash,
        display_name: 'Ev PostCount',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    authorId = author.id;

    const now = new Date();
    const mkEvent = async (title: string) =>
      (
        await prisma.event.create({
          data: {
            title,
            date: now,
            status: 'approved',
            approval_status: 'approved',
            latitude: 40.7128,
            longitude: -74.006,
          },
        })
      ).id;
    withMediaId = await mkEvent(`${TAG}-with-media`);
    noMediaId = await mkEvent(`${TAG}-no-media`);

    const mkPost = async (data: any) => {
      const p = await prisma.post.create({ data: { author_id: authorId, ...data } });
      postIds.push(p.id);
      return p.id;
    };
    // Counts: one media post on withMediaId.
    await mkPost({ event_id: withMediaId, media_url: 'https://res.cloudinary.com/demo/x.jpg' });
    // Does NOT count: a text post (no media) on withMediaId...
    await mkPost({ event_id: withMediaId, content: 'text only', media_url: null });
    // ...and a soft-deleted media post on withMediaId.
    await mkPost({
      event_id: withMediaId,
      media_url: 'https://res.cloudinary.com/demo/y.jpg',
      deleted_at: new Date(),
    });
  });

  afterAll(async () => {
    if (postIds.length) await prisma.post.deleteMany({ where: { id: { in: postIds } } });
    await prisma.event.deleteMany({ where: { id: { in: [withMediaId, noMediaId] } } });
    await prisma.user.deleteMany({ where: { id: authorId } });
  });

  it('reports media_post_count: media posts count; text/deleted do not; none = 0', async () => {
    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .get(`/events?with_post_count=1&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=300`)
      .expect(200);
    const byId = new Map((res.body as any[]).map(e => [e.id, e]));
    expect(byId.get(withMediaId)?.media_post_count).toBe(1);
    expect(byId.get(noMediaId)?.media_post_count).toBe(0);
  });

  it('omits media_post_count entirely when with_post_count is not requested', async () => {
    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .get(`/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=300`)
      .expect(200);
    const mine = (res.body as any[]).find(e => e.id === withMediaId);
    expect(mine).toBeTruthy();
    expect(mine.media_post_count).toBeUndefined();
  });
});
