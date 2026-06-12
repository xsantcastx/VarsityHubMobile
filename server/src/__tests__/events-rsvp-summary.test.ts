import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';
import { describeDb } from './helpers/dbTestSuite.js';

let prisma: any;
let signJwt: any;

describeDb('GET /events/rsvp-summary', () => {
  let user: any;
  let token: string;
  let eventA: any;
  let eventB: any;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    user = await prisma.user.create({
      data: {
        email: `rsvp-summary-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'RSVP Summary User',
        email_verified: true,
        onboarding_completed: true,
      },
    });
    token = signJwt({ id: user.id });
    [eventA, eventB] = await Promise.all([
      prisma.event.create({
        data: {
          title: `RSVP summary A ${Date.now()}`,
          date: new Date(Date.now() + 3600_000),
          location: 'Test Field A',
          status: 'approved',
          approval_status: 'approved',
          creator_id: user.id,
          creator_role: 'fan',
        },
      }),
      prisma.event.create({
        data: {
          title: `RSVP summary B ${Date.now()}`,
          date: new Date(Date.now() + 3600_000),
          location: 'Test Field B',
          status: 'approved',
          approval_status: 'approved',
          creator_id: user.id,
          creator_role: 'fan',
        },
      }),
    ]);
    await prisma.eventRsvp.create({ data: { event_id: eventA.id, user_id: user.id } });
  });

  afterAll(async () => {
    await prisma.eventRsvp.deleteMany({ where: { user_id: user?.id } }).catch(() => {});
    await prisma.event
      .deleteMany({ where: { id: { in: [eventA?.id, eventB?.id].filter(Boolean) } } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: user?.id } }).catch(() => {});
  });

  it('returns counts per event for anonymous viewers, going=false', async () => {
    const res = await request(app)
      .get('/events/rsvp-summary')
      .query({ ids: `${eventA.id},${eventB.id}` });
    expect(res.statusCode).toEqual(200);
    expect(res.body[eventA.id]).toEqual({ going: false, count: 1 });
    expect(res.body[eventB.id]).toEqual({ going: false, count: 0 });
  });

  it("returns the viewer's own going state when authenticated", async () => {
    const res = await request(app)
      .get('/events/rsvp-summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ ids: `${eventA.id},${eventB.id}` });
    expect(res.statusCode).toEqual(200);
    expect(res.body[eventA.id]).toEqual({ going: true, count: 1 });
    expect(res.body[eventB.id]).toEqual({ going: false, count: 0 });
  });

  it('rejects missing ids', async () => {
    const res = await request(app).get('/events/rsvp-summary');
    expect(res.statusCode).toEqual(400);
  });

  it('rejects more than 50 ids', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id${i}`).join(',');
    const res = await request(app).get('/events/rsvp-summary').query({ ids });
    expect(res.statusCode).toEqual(400);
  });
});
