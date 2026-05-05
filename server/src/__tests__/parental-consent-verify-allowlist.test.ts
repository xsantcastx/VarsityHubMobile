/**
 * Parental consent firewall — /auth/verify allowlist regression test.
 *
 * Locks in the rule: a 13–17 minor whose `parental_consent_status` is
 * `pending` MUST still be able to hit /auth/verify/* endpoints. Without
 * this allowlist entry, a minor who provided DOB at registration would
 * be issued a JWT, then firewall-blocked from /auth/verify/confirm,
 * and could never verify their email — permanently locked out.
 *
 * Email verification is foundational: it must remain reachable
 * regardless of consent state. The verify endpoints already require
 * auth, rate-limit, and check email_verified independently, so
 * allowlisting them adds no new attack surface.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;
let hashRefreshToken: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Parental consent firewall — /auth/verify allowlist', () => {
  let minorId: string;
  let minorToken: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt, hashRefreshToken } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);
    // 14 years old — minor, requires parental consent
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 14);

    const minor = await prisma.user.create({
      data: {
        email: `verify-allowlist-minor-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Verify Allowlist Minor',
        username: `verifyminor${ts}`.slice(0, 20),
        email_verified: false,
        approval_status: 'APPROVED',
        date_of_birth: dob,
        parental_consent_status: 'pending',
        preferences: { role: 'fan', onboarding_completed: false },
      } as any,
    });
    minorId = minor.id;
    minorToken = signJwt({ id: minorId });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: minorId } }).catch(() => {});
  });

  it('pending-consent minor can POST /auth/verify/confirm with a valid code', async () => {
    // Stage a fresh verification code on the user (mirrors what /verify/request would do).
    const code = '654321';
    const codeHash = hashRefreshToken(code);
    const exp = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.user.update({
      where: { id: minorId },
      data: { email_verification_code: codeHash, email_verification_expires: exp },
    });

    const res = await request(app)
      .post('/auth/verify/confirm')
      .set('Authorization', `Bearer ${minorToken}`)
      .send({ code });

    // Must NOT be 403 PARENTAL_CONSENT_PENDING — that would mean the firewall
    // ran on the verify endpoint and locked the minor out.
    expect(res.status).not.toBe(403);
    if (res.body?.error) {
      expect(res.body.error).not.toBe('PARENTAL_CONSENT_PENDING');
      expect(res.body.error).not.toBe('PARENTAL_CONSENT_DENIED');
    }
    // Happy path: code verified, email_verified flipped true
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({
      where: { id: minorId },
      select: { email_verified: true } as any,
    });
    expect((after as any)?.email_verified).toBe(true);
  });

  it('pending-consent minor can POST /me/consent/resend without tripping the firewall', async () => {
    await prisma.user.update({
      where: { id: minorId },
      data: {
        email_verified: false,
        parent_email: `guardian-${ts}@example.com`,
        parental_consent_status: 'pending',
      },
    });

    const res = await request(app)
      .post('/me/consent/resend')
      .set('Authorization', `Bearer ${minorToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('pending-consent minor remains firewall-blocked from non-allowlisted routes', async () => {
    // Sanity check that the firewall ITSELF still works — only verify/* is exempt.
    // POST /posts is a representative non-allowlisted route.
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${minorToken}`)
      .send({ content: 'should be blocked', type: 'post' });
    expect(res.status).toBe(403);
    expect(res.body?.error).toBe('PARENTAL_CONSENT_PENDING');
  });
});
