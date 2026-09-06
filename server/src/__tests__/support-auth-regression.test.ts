import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { app } from '../testApp.js';
import { prisma } from '../lib/prisma.js';
import { signJwt } from '../lib/jwt.js';

describe('Support auth regression', () => {
  let userId = '';
  let token = '';
  let email = '';

  beforeAll(async () => {
    const suffix = String(Date.now()).slice(-8);
    email = `support-auth-${suffix}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: 'hash',
        display_name: 'Support Auth',
        username: `support${suffix}`,
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
    token = signJwt({ id: user.id });
  });

  afterAll(async () => {
    if (userId) {
      await prisma.abuseReport.deleteMany({ where: { reporter_id: userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it('allows authenticated users to submit support contact requests', async () => {
    const res = await request(app)
      .post('/support/contact')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Support Auth',
        email,
        subject: 'Regression check',
        message: 'Auth should be honored on support contact.',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, reportId: expect.any(String) });
  });

  it('allows authenticated users to submit support feedback', async () => {
    const res = await request(app)
      .post('/support/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'bug',
        message: 'Auth should be honored on support feedback.',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, reportId: expect.any(String) });
    expect(await prisma.abuseReport.findUnique({ where: { id: res.body.reportId } })).toMatchObject(
      {
        reporter_id: userId,
        message: 'Auth should be honored on support feedback.',
        status: 'pending',
      }
    );
  });

  it('retries a submission without duplicating or replacing the durable message', async () => {
    const submission_id = 'a5719ab2-2ee3-4b76-b185-732977942749';
    const submit = (message: string) =>
      request(app)
        .post('/support/feedback')
        .set('Authorization', `Bearer ${token}`)
        .send({ submission_id, category: 'bug', message });
    const [first, retry] = await Promise.all([
      submit('Original report'),
      submit('Original report'),
    ]);
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(retry.body.reportId).toBe(first.body.reportId);
    await submit('Changed retry body');
    expect(
      await prisma.abuseReport.findUnique({ where: { id: first.body.reportId } })
    ).toMatchObject({ message: 'Original report' });
    expect(
      await prisma.abuseReport.count({
        where: { reporter_id: userId, target_id: submission_id, target_type: 'support_feedback' },
      })
    ).toBe(1);
  });
});
