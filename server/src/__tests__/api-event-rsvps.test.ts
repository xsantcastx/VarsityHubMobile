import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

describe('GET /events/my-rsvps', () => {
  const createdEventIds: string[] = [];
  let userId = '';
  let token = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const user = await prisma.user.create({
      data: {
        email: `event-rsvp-${Date.now()}@example.com`,
        password_hash: passwordHash,
        display_name: 'Event RSVP User',
        email_verified: true,
        onboarding_completed: true,
      },
      select: { id: true },
    });
    userId = user.id;
    token = signJwt({ id: user.id });
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } }).catch(() => {});
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('paginates RSVP history with a stable created_at/id cursor in response headers', async () => {
    const base = Date.now();

    for (let i = 0; i < 3; i += 1) {
      const event = await prisma.event.create({
        data: {
          title: `RSVP Cursor Event ${i}`,
          date: new Date(base + (i + 1) * 24 * 60 * 60 * 1000),
          location: 'RSVP Arena',
          status: 'approved',
          approval_status: 'approved',
          creator_id: userId,
        } as any,
        select: { id: true },
      });
      createdEventIds.push(event.id);
      await prisma.eventRsvp.create({
        data: {
          event_id: event.id,
          user_id: userId,
          created_at: new Date(base - i * 1000),
        },
      });
    }

    const firstPage = await request(app)
      .get('/events/my-rsvps?limit=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(firstPage.body)).toBe(true);
    expect(firstPage.body).toHaveLength(2);
    expect(firstPage.headers['x-has-more']).toBe('1');
    expect(typeof firstPage.headers['x-next-cursor']).toBe('string');

    const secondPage = await request(app)
      .get(
        `/events/my-rsvps?limit=2&cursor=${encodeURIComponent(firstPage.headers['x-next-cursor'])}`
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(secondPage.body)).toBe(true);
    expect(secondPage.body).toHaveLength(1);
    expect(secondPage.headers['x-has-more']).toBe('0');
    expect(secondPage.headers['x-next-cursor']).toBeUndefined();
  });
});
