/**
 * Post creation access tests — all authenticated onboarded users.
 *
 * Covers the change in commit 592d164c: the coach-only gate was removed from
 * POST /posts. Any authenticated, onboarded user (fan, coach, player) should
 * be able to create a post. Unauthenticated requests must still get 401.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../testApp.js';
import { describeDb } from './helpers/dbTestSuite.js';

const ts = randomUUID();

describeDb('Post creation — all authenticated users allowed', () => {
  let prisma: any;
  let signJwt: any;

  let fanUserId = '';
  let fanToken = '';
  let coachUserId = '';
  let coachToken = '';
  let unapprovedCoachToken = '';
  let unapprovedCoachId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash('TestPassword123!', 10);

    // Fan user — fully onboarded
    const fan = await prisma.user.create({
      data: {
        email: `post-fan-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Fan Post User',
        email_verified: true,
        approval_status: 'APPROVED',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    fanUserId = fan.id;
    fanToken = signJwt({ id: fan.id, se: fan.session_epoch ?? 0 });

    // Approved coach
    const coach = await prisma.user.create({
      data: {
        email: `post-coach-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Coach Post User',
        email_verified: true,
        approval_status: 'APPROVED',
        onboarding_completed: true,
        role: 'coach',
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    coachUserId = coach.id;
    coachToken = signJwt({ id: coach.id, se: coach.session_epoch ?? 0 });

    // Unapproved coach — role set but approval_status PENDING
    const unapprovedCoach = await prisma.user.create({
      data: {
        email: `post-unapproved-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Unapproved Coach',
        email_verified: true,
        approval_status: 'PENDING',
        onboarding_completed: true,
        role: 'coach',
        preferences: { role: 'coach', onboarding_completed: true },
      },
    });
    unapprovedCoachId = unapprovedCoach.id;
    unapprovedCoachToken = signJwt({ id: unapprovedCoach.id, se: unapprovedCoach.session_epoch ?? 0 });
  });

  afterAll(async () => {
    for (const id of [fanUserId, coachUserId, unapprovedCoachId]) {
      await prisma.post.deleteMany({ where: { user_id: id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id } }).catch(() => {});
    }
  });

  it('fan can create a text post', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${fanToken}`)
      .send({ content: 'Fan post test content', post_type: 'text' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.author_id).toBe(fanUserId);
  });

  it('approved coach can create a post', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: 'Coach post test content', post_type: 'text' });

    expect(res.status).toBe(201);
    expect(res.body.author_id).toBe(coachUserId);
  });

  it('unauthenticated request is rejected with 401', async () => {
    const res = await request(app)
      .post('/posts')
      .send({ content: 'No auth post', post_type: 'text' });

    expect(res.status).toBe(401);
  });

  it('fan cannot create a post without content', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${fanToken}`)
      .send({ post_type: 'text' });

    // Should be a validation error, not a 403 coach gate
    expect(res.status).not.toBe(403);
    expect([400, 422].includes(res.status)).toBe(true);
  });
});
