import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';

let prisma: any;
let signReviewToken: any;
let signJwt: any;
let app: import('express').Express;
let getOrganizationJoinRequestState: any;
let getOrganizationMembership: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Coach join request email-token review routes', () => {
  let ownerId = '';
  let coachId = '';
  let orgId = '';
  let requestId = '';

  beforeAll(async () => {
    ({ app } = await import('../testApp.js'));
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signReviewToken } = await import('../lib/reviewTokens.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    ({ getOrganizationJoinRequestState } = await import('../lib/organizationWorkflowState.js'));
    ({ getOrganizationMembership } = await import('../lib/organizationAuthorization.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    const owner = await prisma.user.create({
      data: {
        email: `coach-join-owner-${ts}@example.com`,
        password_hash: hash,
        display_name: 'League Owner',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'coach', onboarding_completed: true },
      },
    });
    ownerId = owner.id;

    const coach = await prisma.user.create({
      data: {
        email: `coach-join-coach-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Pending Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'PENDING',
        preferences: { role: 'coach', onboarding_completed: true },
      },
    });
    coachId = coach.id;

    const org = await prisma.organization.create({
      data: {
        name: `Coach Join Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: owner.id,
      },
      select: { id: true },
    });
    orgId = org.id;

    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: owner.id, role: 'owner', status: 'active' },
      select: { id: true },
    });

    const joinRequest = await prisma.organizationJoinRequest.create({
      data: {
        organization_id: orgId,
        user_id: coach.id,
        status: 'pending',
      },
      select: { id: true },
    });
    requestId = joinRequest.id;
  });

  afterAll(async () => {
    await prisma.notification
      .deleteMany({ where: { user_id: { in: [ownerId, coachId] } } })
      .catch(() => {});
    await prisma.organizationJoinRequest
      .deleteMany({ where: { organization_id: orgId } })
      .catch(() => {});
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: orgId } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, coachId] } } }).catch(() => {});
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get(`/organizations/join-requests/${requestId}/email/approve`);
    expect(res.status).toBe(401);
    expect(res.text).toMatch(/Link Expired/i);
  });

  it('rejects requests with a token that does not match the request', async () => {
    const wrongToken = signReviewToken(
      { requestId: 'some-other-request', orgId, action: 'approve_join_request' },
      '48h'
    );
    const res = await request(app).get(
      `/organizations/join-requests/${requestId}/email/approve?token=${encodeURIComponent(wrongToken)}`
    );
    expect(res.status).toBe(401);
    expect(res.text).toMatch(/Link Expired/i);
  });

  it('rejects requests with a token whose organization binding does not match the join request', async () => {
    const wrongOrgToken = signReviewToken(
      { requestId, orgId: 'org_other', action: 'approve_join_request' },
      '48h'
    );
    const res = await request(app).get(
      `/organizations/join-requests/${requestId}/email/approve?token=${encodeURIComponent(wrongOrgToken)}`
    );
    expect(res.status).toBe(401);
    expect(res.text).toMatch(/Link Expired/i);
  });

  it('approves the coach directly on GET with a valid approve token (no confirmation form)', async () => {
    const token = signReviewToken({ requestId, orgId, action: 'approve_join_request' }, '48h');
    const res = await request(app).get(
      `/organizations/join-requests/${requestId}/email/approve?token=${encodeURIComponent(token)}`
    );
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Coach Approved/i);
    expect(res.text).toMatch(/Pending Coach/);

    const requestAfter = await getOrganizationJoinRequestState(requestId);
    expect(requestAfter?.status).toBe('approved');
    expect(requestAfter?.reviewed_by).toBe(ownerId);

    const membership = await getOrganizationMembership(coachId, orgId);
    expect(membership?.role).toBe('coach');

    const coachAfter = await prisma.user.findUnique({
      where: { id: coachId },
      select: { approval_status: true },
    });
    expect(coachAfter?.approval_status).toBe('APPROVED');
  });

  it('shows an "already reviewed" page when the join request is no longer pending', async () => {
    // The previous test already approved this request, so a new token now lands
    // on the request-status guard rather than executing again.
    const token = signReviewToken({ requestId, orgId, action: 'approve_join_request' }, '48h');
    const res = await request(app).get(
      `/organizations/join-requests/${requestId}/email/approve?token=${encodeURIComponent(token)}`
    );
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Already Approved|Already Reviewed/i);
  });
});

// ─── Task 3 + 4: Agreement fields and admin audit log ────────────────────────

describe('Join-request approval stamps agreement fields (email-link path)', () => {
  const ts2 = Date.now() + 1;
  let ownerId2 = '';
  let coachId2 = '';
  let orgId2 = '';
  let requestId2 = '';

  beforeAll(async () => {
    const hash = await bcrypt.hash('TestPassword123!', 10);

    const owner = await prisma.user.create({
      data: {
        email: `agr-email-owner-${ts2}@test.com`,
        password_hash: hash,
        display_name: 'Agr Email Owner',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'coach', onboarding_completed: true },
      },
    });
    ownerId2 = owner.id;

    const coach = await prisma.user.create({
      data: {
        email: `agr-email-coach-${ts2}@test.com`,
        password_hash: hash,
        display_name: 'Agr Email Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'PENDING',
        coach_agreement_accepted_at: null,
        coach_agreement_version: null,
        preferences: { role: 'coach', onboarding_completed: true, join_request_pending: true },
      },
    });
    coachId2 = coach.id;

    const org = await prisma.organization.create({
      data: { name: `Agr Email Org ${ts2}`, admin_approved: true, league_owner_id: ownerId2 },
    });
    orgId2 = org.id;

    await prisma.organizationMembership.create({
      data: { organization_id: orgId2, user_id: ownerId2, role: 'owner', status: 'active' },
    });

    const jr = await prisma.organizationJoinRequest.create({
      data: { organization_id: orgId2, user_id: coachId2, status: 'pending' },
    });
    requestId2 = jr.id;
  });

  afterAll(async () => {
    await prisma.adminActivityLog.deleteMany({ where: { target_id: coachId2 } }).catch(() => {});
    await prisma.notification
      .deleteMany({ where: { user_id: { in: [ownerId2, coachId2] } } })
      .catch(() => {});
    await prisma.organizationJoinRequest
      .deleteMany({ where: { organization_id: orgId2 } })
      .catch(() => {});
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: orgId2 } })
      .catch(() => {});
    await prisma.organization.delete({ where: { id: orgId2 } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [ownerId2, coachId2] } } }).catch(() => {});
  });

  it('sets coach_agreement_accepted_at and coach_agreement_version via email-link approval', async () => {
    const token = signReviewToken(
      { requestId: requestId2, orgId: orgId2, action: 'approve_join_request' },
      '48h'
    );
    const res = await request(app).get(
      `/organizations/join-requests/${requestId2}/email/approve?token=${encodeURIComponent(token)}`
    );
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({
      where: { id: coachId2 },
      select: {
        approval_status: true,
        coach_agreement_accepted_at: true,
        coach_agreement_version: true,
      },
    });

    expect(updated?.approval_status).toBe('APPROVED');
    expect(updated?.coach_agreement_accepted_at).not.toBeNull();
    expect(updated?.coach_agreement_version).toBe(
      Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1)
    );
  });

  it('creates an AdminActivityLog entry via email-link approval', async () => {
    // Request was already approved in the previous test — log entry should exist
    const logEntry = await prisma.adminActivityLog.findFirst({
      where: { action: 'APPROVE_JOIN_REQUEST', target_id: coachId2 },
      orderBy: { timestamp: 'desc' },
    });

    expect(logEntry).not.toBeNull();
    expect(logEntry?.target_type).toBe('user');
  });
});

describe('Join-request approval stamps agreement fields (in-app path)', () => {
  const ts3 = Date.now() + 2;
  let ownerId3 = '';
  let ownerToken3 = '';
  let coachId3 = '';
  let orgId3 = '';
  let requestId3 = '';

  beforeAll(async () => {
    const hash = await bcrypt.hash('TestPassword123!', 10);

    const owner = await prisma.user.create({
      data: {
        email: `agr-inapp-owner-${ts3}@test.com`,
        password_hash: hash,
        display_name: 'InApp Owner',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: 1,
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
          coach_agreement_version: 1,
        },
      },
    });
    ownerId3 = owner.id;
    ownerToken3 = signJwt({ id: ownerId3 });

    const coach = await prisma.user.create({
      data: {
        email: `agr-inapp-coach-${ts3}@test.com`,
        password_hash: hash,
        display_name: 'InApp Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'PENDING',
        coach_agreement_accepted_at: null,
        coach_agreement_version: null,
        preferences: { role: 'coach', onboarding_completed: true, join_request_pending: true },
      },
    });
    coachId3 = coach.id;

    const org = await prisma.organization.create({
      data: { name: `InApp Org ${ts3}`, admin_approved: true, league_owner_id: ownerId3 },
    });
    orgId3 = org.id;

    await prisma.user.update({
      where: { id: ownerId3 },
      data: { organization_id: orgId3 },
    });

    await prisma.organizationMembership.create({
      data: { organization_id: orgId3, user_id: ownerId3, role: 'owner', status: 'active' },
    });

    const jr = await prisma.organizationJoinRequest.create({
      data: { organization_id: orgId3, user_id: coachId3, status: 'pending' },
    });
    requestId3 = jr.id;
  });

  afterAll(async () => {
    await prisma.adminActivityLog.deleteMany({ where: { target_id: coachId3 } }).catch(() => {});
    await prisma.notification
      .deleteMany({ where: { user_id: { in: [ownerId3, coachId3] } } })
      .catch(() => {});
    await prisma.organizationJoinRequest
      .deleteMany({ where: { organization_id: orgId3 } })
      .catch(() => {});
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: orgId3 } })
      .catch(() => {});
    await prisma.organization.delete({ where: { id: orgId3 } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [ownerId3, coachId3] } } }).catch(() => {});
  });

  it('sets coach_agreement_accepted_at and coach_agreement_version via in-app approval', async () => {
    const res = await request(app)
      .post(`/organizations/join-requests/${requestId3}/approve`)
      .set('Authorization', `Bearer ${ownerToken3}`);

    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({
      where: { id: coachId3 },
      select: {
        approval_status: true,
        coach_agreement_accepted_at: true,
        coach_agreement_version: true,
      },
    });

    expect(updated?.approval_status).toBe('APPROVED');
    expect(updated?.coach_agreement_accepted_at).not.toBeNull();
    expect(updated?.coach_agreement_version).toBe(
      Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1)
    );
  });

  it('creates an AdminActivityLog entry via in-app approval', async () => {
    const logEntry = await prisma.adminActivityLog.findFirst({
      where: { action: 'APPROVE_JOIN_REQUEST', target_id: coachId3 },
      orderBy: { timestamp: 'desc' },
    });

    expect(logEntry).not.toBeNull();
    expect(logEntry?.admin_id).toBe(ownerId3);
    expect(logEntry?.target_type).toBe('user');
  });
});
