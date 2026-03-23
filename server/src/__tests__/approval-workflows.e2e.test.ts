import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';

import { authMiddleware } from '../middleware/auth.js';
import { adsRouter } from '../routes/ads.js';
import { organizationsRouter } from '../routes/organizations.js';
import { teamsRouter } from '../routes/teams.js';

let prisma: any;
let signJwt: any;
let runFinalizeFromSession: (session: any) => Promise<void>;
let dbReady = false;

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1' || !process.env.DATABASE_URL;
const describeDb = shouldSkipDbTests ? describe.skip : describe;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

const approvalApp = express();
approvalApp.use(express.json());
approvalApp.use(authMiddleware);
approvalApp.use('/organizations', organizationsRouter);
approvalApp.use('/teams', teamsRouter);
approvalApp.use('/ads', adsRouter);
approvalApp.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  if (typeof err?.toJSON === 'function') {
    return res.status(status).json(err.toJSON());
  }
  return res.status(status).json({ error: err?.message || 'Internal server error' });
});

describeDb('Approval workflows confidence pack (DB-backed)', () => {
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdTeamIds: string[] = [];
  const createdJoinRequestIds: string[] = [];
  const createdAdIds: string[] = [];
  const createdSessionIds: string[] = [];

  async function createUser(data: {
    email: string;
    displayName: string;
    role: 'fan' | 'coach';
    plan?: 'rookie' | 'veteran' | 'legend';
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  }) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password_hash: passwordHash,
        display_name: data.displayName,
        email_verified: true,
        approval_status: data.approvalStatus ?? 'APPROVED',
        preferences: {
          role: data.role,
          plan: data.plan ?? (data.role === 'coach' ? 'rookie' : undefined),
          onboarding_completed: true,
        },
      },
    });
    createdUserIds.push(user.id);
    return { id: user.id as string, token: signJwt({ id: user.id }) as string, email: user.email as string };
  }

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    const paymentsModule = await import('../routes/payments.js');
    runFinalizeFromSession = paymentsModule.__paymentsInternal.runFinalizeFromSession;

    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  afterAll(async () => {
    if (!prisma || !dbReady) return;

    if (createdSessionIds.length) {
      await prisma.transactionLog.deleteMany({
        where: { stripe_session_id: { in: createdSessionIds } },
      }).catch(() => {});
    }

    if (createdAdIds.length) {
      await prisma.adReservation.deleteMany({
        where: { ad_id: { in: createdAdIds } },
      }).catch(() => {});
      await prisma.ad.deleteMany({
        where: { id: { in: createdAdIds } },
      }).catch(() => {});
    }

    if (createdTeamIds.length) {
      await prisma.teamMembership.deleteMany({
        where: { team_id: { in: createdTeamIds } },
      }).catch(() => {});
      await prisma.team.deleteMany({
        where: { id: { in: createdTeamIds } },
      }).catch(() => {});
    }

    if (createdJoinRequestIds.length) {
      await prisma.organizationJoinRequest.deleteMany({
        where: { id: { in: createdJoinRequestIds } },
      }).catch(() => {});
    }

    if (createdOrgIds.length) {
      await prisma.organizationMembership.deleteMany({
        where: { organization_id: { in: createdOrgIds } },
      }).catch(() => {});
      await prisma.organization.deleteMany({
        where: { id: { in: createdOrgIds } },
      }).catch(() => {});
    }

    if (createdUserIds.length) {
      await prisma.notification.deleteMany({
        where: { OR: [{ user_id: { in: createdUserIds } }, { actor_id: { in: createdUserIds } }] },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }
  });

  it('coach approval flow blocks pending coach and unlocks team creation after approval', async () => {
    if (!dbReady) return;

    const owner = await createUser({
      email: `approval-owner-${ts}@example.com`,
      displayName: 'Approval Owner',
      role: 'coach',
      plan: 'veteran',
      approvalStatus: 'APPROVED',
    });
    const applicant = await createUser({
      email: `approval-applicant-${ts}@example.com`,
      displayName: 'Approval Applicant',
      role: 'coach',
      plan: 'rookie',
      approvalStatus: 'APPROVED',
    });

    const org = await prisma.organization.create({
      data: {
        name: `Approval Confidence Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: owner.id,
      },
    });
    createdOrgIds.push(org.id);

    await prisma.organizationMembership.create({
      data: { organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active' },
    });

    const joinRes = await request(approvalApp)
      .post(`/organizations/${org.id}/join-requests`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({ message: 'Requesting coach access' });

    expect(joinRes.status).toBe(201);
    expect(joinRes.body?.id).toBeTruthy();
    createdJoinRequestIds.push(joinRes.body.id);

    const applicantAfterRequest = await prisma.user.findUnique({
      where: { id: applicant.id },
      select: { approval_status: true },
    });
    expect(applicantAfterRequest?.approval_status).toBe('PENDING');

    const blockedRes = await request(approvalApp)
      .post('/teams/create')
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({ name: `Pending Blocked Team ${ts}`, organization_id: org.id });
    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body?.code).toBe('APPROVAL_REQUIRED');

    const pendingCanonicalRes = await request(approvalApp)
      .get(`/organizations/${org.id}/pending-coaches`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(pendingCanonicalRes.status).toBe(200);
    expect(
      Array.isArray(pendingCanonicalRes.body) &&
      pendingCanonicalRes.body.some((req: any) => req?.user?.id === applicant.id)
    ).toBe(true);

    const pendingAliasRes = await request(approvalApp)
      .get(`/organizations/${org.id}/coaches/pending`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(pendingAliasRes.status).toBe(200);
    expect(
      Array.isArray(pendingAliasRes.body) &&
      pendingAliasRes.body.some((req: any) => req?.user?.id === applicant.id)
    ).toBe(true);

    const approveRes = await request(approvalApp)
      .post(`/organizations/join-requests/${joinRes.body.id}/approve`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({});
    expect(approveRes.status).toBe(200);

    const applicantAfterApproval = await prisma.user.findUnique({
      where: { id: applicant.id },
      select: { approval_status: true, paid_by_owner: true },
    });
    expect(applicantAfterApproval?.approval_status).toBe('APPROVED');
    expect(applicantAfterApproval?.paid_by_owner).toBe(true);

    const unblockedRes = await request(approvalApp)
      .post('/teams/create')
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({ name: `Approved Team ${ts}`, organization_id: org.id });
    expect(unblockedRes.status).toBe(201);

    const teamId = unblockedRes.body?.id || unblockedRes.body?.team?.id;
    if (teamId) createdTeamIds.push(teamId);
  });

  it('ad approval + payment finalization transitions ad to active/paid', async () => {
    if (!dbReady) return;

    const advertiser = await createUser({
      email: `approval-advertiser-${ts}@example.com`,
      displayName: 'Approval Advertiser',
      role: 'fan',
      approvalStatus: 'APPROVED',
    });

    const createAdRes = await request(approvalApp)
      .post('/ads')
      .set('Authorization', `Bearer ${advertiser.token}`)
      .send({
        contact_name: 'Ad Contact',
        contact_email: advertiser.email,
        business_name: `Approval Ad Biz ${ts}`,
        banner_url: 'https://example.com/banner.jpg',
        target_url: 'https://example.com/landing',
        target_zip_code: '10001',
        description: 'Approval confidence test ad',
      });
    expect(createAdRes.status).toBe(201);
    const adId = createAdRes.body?.id as string;
    expect(adId).toBeTruthy();
    createdAdIds.push(adId);

    const date1 = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const date2 = new Date(Date.now() + 11 * 86400000).toISOString().slice(0, 10);

    const submitRes = await request(approvalApp)
      .post(`/ads/${adId}/submit-for-approval`)
      .set('Authorization', `Bearer ${advertiser.token}`)
      .send({ dates: [date1, date2] });
    expect(submitRes.status).toBe(200);
    expect(submitRes.body?.status).toBe('pending');
    expect(submitRes.body?.payment_status).toBe('pending_approval');

    const approveToken = signJwt({ adId, action: 'approve_ad' }, '7d');
    const tokenApproveRes = await request(approvalApp).get(`/ads/${adId}/approve?token=${encodeURIComponent(approveToken)}`);
    expect(tokenApproveRes.status).toBe(200);

    const approvedAd = await prisma.ad.findUnique({ where: { id: adId } });
    expect(approvedAd?.status).toBe('approved');
    expect(approvedAd?.payment_status).toBe('unpaid');

    const sessionId = `sess_approval_confidence_${Date.now()}`;
    createdSessionIds.push(sessionId);

    await prisma.transactionLog.create({
      data: {
        transaction_type: 'AD_PURCHASE',
        status: 'PENDING',
        stripe_session_id: sessionId,
        user_id: advertiser.id,
        user_email: advertiser.email,
        order_id: adId,
        subtotal_cents: 1300,
        total_cents: 1300,
        currency: 'usd',
      },
    });

    await runFinalizeFromSession({
      id: sessionId,
      payment_status: 'paid',
      status: 'complete',
      amount_total: 1300,
      payment_intent: 'pi_approval_confidence_test',
      metadata: {
        ad_id: adId,
        user_id: advertiser.id,
        dates: JSON.stringify([date1, date2]),
        total_cents: '1300',
      },
      customer_details: { email: advertiser.email },
    });

    const paidAd = await prisma.ad.findUnique({ where: { id: adId } });
    const tx = await prisma.transactionLog.findUnique({ where: { stripe_session_id: sessionId } });

    expect(paidAd?.status).toBe('active');
    expect(paidAd?.payment_status).toBe('paid');
    expect(tx?.status).toBe('COMPLETED');
    expect(tx?.stripe_payment_intent_id).toBe('pi_approval_confidence_test');
  });
});
