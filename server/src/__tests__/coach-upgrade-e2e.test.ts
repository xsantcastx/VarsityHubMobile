/**
 * Coach upgrade end-to-end integration test.
 *
 * Drives `POST /auth/upgrade-to-coach` against a seeded fan account and
 * verifies every server-side state transition the client relies on:
 *
 *   1. preferences.role flips from 'fan' to 'coach'
 *   2. preferences.plan / pending_plan reflect whether billing is deferred
 *   3. preferences.onboarding_completed resets to false (so coach must
 *      complete coach-specific onboarding steps)
 *   4. approval_status resets to 'PENDING' (coach must be approved
 *      before accessing coach tools)
 *   5. rejected_at / rejection_reason cleared on fresh re-apply
 *   6. /auth/me returns the full mutated shape AND the new
 *      required_coach_agreement_version alias for the client to read
 *
 * This is the exact flow that silently broke in 1.0.1: the server-side
 * endpoint worked but the client read stale `/me` cache after the POST.
 * Pinning the server half here means any future server regression
 * surfaces in CI instead of at device-smoke-test time.
 *
 * Skips cleanly when no real Postgres is available (sandbox / CI
 * without the test DB). Integration tests require the describeDb
 * pattern used elsewhere in the suite.
 */
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import { PASSWORD, adultDob, describeDb, loadAuthE2eDeps } from './helpers/authE2eTestUtils.js';

let prisma: any;
let request: any;
let app: import('express').Express;
let signJwt: any;

const ts = Date.now();

describeDb('POST /auth/upgrade-to-coach — fan → coach state transition', () => {
  let fanUserId: string;
  let fanToken: string;

  beforeAll(async () => {
    ({ prisma, signJwt, request, app } = await loadAuthE2eDeps());

    const hash = await bcrypt.hash(PASSWORD, 10);
    const fan = await prisma.user.create({
      data: {
        email: `coach-upgrade-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Upgrade Candidate',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: adultDob(),
        preferences: {
          role: 'fan',
          plan: 'rookie',
          onboarding_completed: true,
        },
      },
    });
    fanUserId = fan.id;
    fanToken = signJwt({ id: fanUserId });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: fanUserId } }).catch(() => {});
  });

  it('flips fan → coach with plan, resets onboarding, stamps PENDING approval', async () => {
    const res = await request(app)
      .post('/auth/upgrade-to-coach')
      .set('Authorization', `Bearer ${fanToken}`)
      .send({ plan: 'rookie' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Read fresh user state from DB — NOT trusting the response alone,
    // because we want to verify the mutation actually persisted.
    const updated = await prisma.user.findUnique({ where: { id: fanUserId } });
    expect(updated).not.toBeNull();
    const prefs = updated!.preferences as any;

    expect(prefs.role).toBe('coach');
    expect(prefs.plan).toBe('rookie');
    expect(prefs.onboarding_completed).toBe(false);
    expect(updated!.approval_status).toBe('PENDING');
    // Fresh re-apply clears any prior rejection state
    expect(updated!.rejected_at).toBeNull();
    expect(updated!.rejection_reason).toBeNull();
  });

  it('stores paid coach upgrades as pending checkout instead of granting the paid tier immediately', async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const paidFan = await prisma.user.create({
      data: {
        email: `coach-upgrade-paid-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Paid Upgrade Candidate',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: adultDob(),
        preferences: {
          role: 'fan',
          plan: 'rookie',
          onboarding_completed: true,
        },
      },
    });
    const paidFanToken = signJwt({ id: paidFan.id });

    try {
      const res = await request(app)
        .post('/auth/upgrade-to-coach')
        .set('Authorization', `Bearer ${paidFanToken}`)
        .send({ plan: 'veteran' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const updated = await prisma.user.findUnique({ where: { id: paidFan.id } });
      expect(updated).not.toBeNull();
      const prefs = updated!.preferences as any;

      expect(prefs.role).toBe('coach');
      expect(prefs.plan).toBe('rookie');
      expect(prefs.pending_plan).toBe('veteran');
      expect(prefs.payment_pending).toBe(true);
      expect(prefs.onboarding_completed).toBe(false);
      expect(updated!.approval_status).toBe('PENDING');
    } finally {
      await prisma.user.delete({ where: { id: paidFan.id } }).catch(() => {});
    }
  });

  it('returns the new coach state on /auth/me including required_coach_agreement_version', async () => {
    // Issue the upgrade (may re-upgrade if the prior test ran first;
    // the endpoint short-circuits with 400 for already-coach. Handle
    // both paths so the assertion about /me's shape is what we're
    // really testing here.)
    await request(app)
      .post('/auth/upgrade-to-coach')
      .set('Authorization', `Bearer ${fanToken}`)
      .send({ plan: 'rookie' });

    const meRes = await request(app).get('/auth/me').set('Authorization', `Bearer ${fanToken}`);

    expect(meRes.status).toBe(200);
    // The DISC-2 fix: client reads this number to decide whether the
    // agreement needs re-accepting. Must be a number >= 1.
    const requiredVersion = Number(meRes.body.required_coach_agreement_version);
    expect(Number.isFinite(requiredVersion)).toBe(true);
    expect(requiredVersion).toBeGreaterThanOrEqual(1);

    // Preferences should reflect the coach state the upgrade set.
    const prefs = meRes.body.preferences ?? meRes.body;
    expect(prefs.role).toBe('coach');
    expect(prefs.onboarding_completed).toBe(false);
    expect(meRes.body.approval_status).toBe('PENDING');
  });

  it('rejects a second upgrade attempt with already-a-coach 400', async () => {
    const res = await request(app)
      .post('/auth/upgrade-to-coach')
      .set('Authorization', `Bearer ${fanToken}`)
      .send({ plan: 'veteran' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('COACH_UPGRADE_IN_PROGRESS');
    expect(String(res.body.error || '').toLowerCase()).toContain('already');
    expect(typeof res.body.next_step).toBe('string');
  });

  it('enforces 18+ age gate — under-18 user gets AGE_REQUIREMENT 403', async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const underageDob = new Date();
    underageDob.setUTCFullYear(underageDob.getUTCFullYear() - 15);

    const minor = await prisma.user.create({
      data: {
        email: `coach-upgrade-minor-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Underage',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: underageDob,
        preferences: {
          role: 'fan',
          plan: 'rookie',
          onboarding_completed: true,
        },
      },
    });
    const minorToken = signJwt({ id: minor.id });

    try {
      const res = await request(app)
        .post('/auth/upgrade-to-coach')
        .set('Authorization', `Bearer ${minorToken}`)
        .send({ plan: 'rookie' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AGE_REQUIREMENT');

      const stillMinor = await prisma.user.findUnique({ where: { id: minor.id } });
      const prefs = stillMinor!.preferences as any;
      // Critical: the failed upgrade must NOT have flipped role partway.
      expect(prefs.role).toBe('fan');
      expect(stillMinor!.approval_status).toBe('APPROVED'); // still the old state
    } finally {
      await prisma.user.delete({ where: { id: minor.id } }).catch(() => {});
    }
  });
});
