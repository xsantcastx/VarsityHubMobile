/**
 * Parental consent firewall — /auth/verify allowlist regression test.
 *
 * Locks in the rule: even a legacy under-13 account must still be able to hit
 * /auth/verify/* endpoints. Without this allowlist entry, a legacy child user
 * would be issued a JWT, then firewall-blocked from /auth/verify/confirm, and
 * could never verify their email.
 *
 * Email verification is foundational: it must remain reachable regardless of
 * COPPA enforcement state. The verify endpoints already require auth,
 * rate-limit, and check email_verified independently, so allowlisting them
 * adds no new attack surface.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';
import { prisma } from '../lib/prisma.js';
import { signJwt, hashRefreshToken } from '../lib/jwt.js';

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Parental consent firewall — /auth/verify allowlist', () => {
  let childId: string;
  let childToken: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    // 12 years old — legacy under-13 account, blocked by the COPPA firewall
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 12);

    const child = await prisma.user.create({
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
    childId = child.id;
    childToken = signJwt({ id: childId });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: childId } }).catch(() => {});
  });

  it('legacy under-13 user can POST /auth/verify/confirm with a valid code', async () => {
    // Stage a fresh verification code on the user (mirrors what /verify/request would do).
    const code = '654321';
    const codeHash = hashRefreshToken(code);
    const exp = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.user.update({
      where: { id: childId },
      data: { email_verification_code: codeHash, email_verification_expires: exp },
    });

    const res = await request(app)
      .post('/auth/verify/confirm')
      .set('Authorization', `Bearer ${childToken}`)
      .send({ code });

    // Must NOT be 403 COPPA_UNDER_13 — that would mean the firewall ran on the
    // verify endpoint and locked the user out.
    expect(res.status).not.toBe(403);
    if (res.body?.error) {
      expect(res.body.error).not.toBe('COPPA_UNDER_13');
    }
    // Happy path: code verified, email_verified flipped true
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({
      where: { id: childId },
      select: { email_verified: true } as any,
    });
    expect((after as any)?.email_verified).toBe(true);
  });

  it('legacy under-13 user remains firewall-blocked from non-allowlisted routes', async () => {
    // Sanity check that the firewall itself still works — only verify/* is exempt.
    // POST /posts is a representative non-allowlisted route.
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${childToken}`)
      .send({ content: 'should be blocked', type: 'post' });
    expect(res.status).toBe(403);
    expect(res.body?.error).toBe('COPPA_UNDER_13');
  });
});
