/**
 * Coach agreement version-stamping test.
 *
 * Locks in the server-side normalize: when a client patches
 * `coach_agreement_accepted_at` via PATCH /me/preferences, the server
 * automatically stamps `coach_agreement_version` with the current value of
 * REQUIRED_COACH_AGREEMENT_VERSION. Without this, a coach re-accepting an
 * updated agreement would still be gated by COACH_AGREEMENT_OUTDATED
 * because the client doesn't write the version field.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Coach Agreement Versioning', () => {
  let coachId: string;
  let coachToken: string;
  const originalEnv = process.env.REQUIRED_COACH_AGREEMENT_VERSION;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);
    const coach = await prisma.user.create({
      data: {
        email: `agreement-version-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Version Test Coach',
        username: `versioncoach${ts}`.slice(0, 20),
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1990-01-01'),
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
        },
      },
    });
    coachId = coach.id;
    coachToken = signJwt({ id: coachId });
  });

  afterAll(async () => {
    if (originalEnv === undefined) delete process.env.REQUIRED_COACH_AGREEMENT_VERSION;
    else process.env.REQUIRED_COACH_AGREEMENT_VERSION = originalEnv;
    await prisma.user.deleteMany({ where: { id: coachId } }).catch(() => {});
  });

  it('PATCH /me/preferences with coach_agreement_accepted_at also stamps coach_agreement_version', async () => {
    process.env.REQUIRED_COACH_AGREEMENT_VERSION = '3';

    const res = await request(app)
      .patch('/auth/me/preferences')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ coach_agreement_accepted_at: new Date().toISOString() });
    expect(res.status).toBe(200);

    const after = await prisma.user.findUnique({
      where: { id: coachId },
      select: { preferences: true },
    });
    const prefs = (after?.preferences as any) || {};
    expect(prefs.coach_agreement_accepted_at).toBeTruthy();
    expect(prefs.coach_agreement_version).toBe(3);
  });

  it('PATCH without coach_agreement_accepted_at does NOT touch coach_agreement_version', async () => {
    process.env.REQUIRED_COACH_AGREEMENT_VERSION = '5';
    // Set version manually to 3 first
    await prisma.user.update({
      where: { id: coachId },
      data: {
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
          coach_agreement_version: 3,
        },
      } as any,
    });

    const res = await request(app)
      .patch('/auth/me/preferences')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ notifications_enabled: false });
    expect(res.status).toBe(200);

    const after = await prisma.user.findUnique({
      where: { id: coachId },
      select: { preferences: true },
    });
    const prefs = (after?.preferences as any) || {};
    expect(prefs.coach_agreement_version).toBe(3);
  });
});
