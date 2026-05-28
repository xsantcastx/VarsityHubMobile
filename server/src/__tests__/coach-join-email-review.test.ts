import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';

let prisma: any;
let signReviewToken: any;
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
    await prisma.organizationJoinRequest.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, coachId] } } }).catch(() => {});
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get(
      `/organizations/join-requests/${requestId}/email/approve`
    );
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
    const token = signReviewToken(
      { requestId, orgId, action: 'approve_join_request' },
      '48h'
    );
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
    const token = signReviewToken(
      { requestId, orgId, action: 'approve_join_request' },
      '48h'
    );
    const res = await request(app).get(
      `/organizations/join-requests/${requestId}/email/approve?token=${encodeURIComponent(token)}`
    );
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Already Approved|Already Reviewed/i);
  });
});
