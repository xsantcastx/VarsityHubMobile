import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';

const src = readFileSync(join(process.cwd(), 'src', 'routes', 'organizations.ts'), 'utf8');

function sliceBetween(startMarker: string, endMarker: string): string {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  return src.slice(start, end);
}

describe('organization email review token order', () => {
  it('a failed decision transaction rolls back its effects and the same email token remains retryable', async () => {
    const { app } = await import('../testApp.js');
    const { prisma } = await import('../lib/prisma.js');
    const { buildCoachJoinRequestReviewUrl } = await import('../lib/email.js');
    const label = `reviewrollback${Date.now()}`;
    const owner = await prisma.user.create({ data: { email: `${label}-owner@example.com` } });
    const coach = await prisma.user.create({
      data: { email: `${label}-coach@example.com`, approval_status: 'PENDING' },
    });
    const org = await prisma.organization.create({
      data: { name: label, league_owner_id: owner.id, admin_approved: true },
    });
    const pending = await prisma.organizationJoinRequest.create({
      data: { organization_id: org.id, user_id: coach.id },
    });
    const url = new URL(
      buildCoachJoinRequestReviewUrl({
        organizationId: org.id,
        requestId: pending.id,
        reviewerUserId: owner.id,
        requestCreatedAt: pending.created_at,
      })
    );
    const path = url.pathname + url.search;
    let failNotification = true;
    // Inject a genuine PostgreSQL FK failure after the guarded decision and
    // membership writes, within the real Prisma transaction. No provider calls.
    prisma.$use(async (params, next) => {
      if (
        failNotification &&
        params.model === 'Notification' &&
        params.action === 'create' &&
        params.args?.data?.user_id === coach.id
      ) {
        failNotification = false;
        params.args.data.user_id = `missing-${coach.id}`;
      }
      return next(params);
    });
    try {
      await request(app).get(path).expect(500);
      expect(
        await prisma.organizationJoinRequest.findUnique({ where: { id: pending.id } })
      ).toMatchObject({ status: 'pending', reviewed_by: null });
      expect(await prisma.user.findUnique({ where: { id: coach.id } })).toMatchObject({
        approval_status: 'PENDING',
      });
      expect(
        await prisma.organizationMembership.count({
          where: { user_id: coach.id, organization_id: org.id },
        })
      ).toBe(0);
      expect(await prisma.adminActivityLog.count({ where: { target_id: coach.id } })).toBe(0);
      expect(await prisma.notification.count({ where: { user_id: coach.id } })).toBe(0);
      await request(app).get(path).expect(200);
      await request(app).get(path).expect(200);
      expect(
        await prisma.organizationJoinRequest.findUnique({ where: { id: pending.id } })
      ).toMatchObject({ status: 'approved', reviewed_by: owner.id });
      expect(await prisma.adminActivityLog.count({ where: { target_id: coach.id } })).toBe(1);
      expect(await prisma.notification.count({ where: { user_id: coach.id } })).toBe(1);
    } finally {
      failNotification = false;
      await prisma.adminActivityLog.deleteMany({ where: { target_id: coach.id } });
      await prisma.notification.deleteMany({ where: { user_id: coach.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.user.deleteMany({ where: { id: { in: [owner.id, coach.id] } } });
    }
  });

  it('renders precise join-request state pages and action-specific invalid-link copy', () => {
    const slice = sliceBetween(
      'async function joinRequestEmailReviewHandler',
      "organizationsRouter.get('/join-requests/:requestId/email/approve'"
    );
    expect(src).toContain('function renderJoinRequestStatePage(');
    expect(slice).toContain("const linkLabel = action === 'approve' ? 'approval' : 'rejection'");
    expect(slice).toContain('This ${linkLabel} link is missing or invalid.');
    expect(slice).toContain('This ${linkLabel} link is no longer valid.');
    expect(slice).toContain('return res.send(');
    expect(slice).toContain('renderJoinRequestStatePage(joinRequest, action, {');
  });

  it('join-request email links execute directly and render final button state without a second confirmation form', () => {
    const slice = sliceBetween(
      'async function joinRequestEmailReviewHandler',
      "organizationsRouter.get('/join-requests/:requestId/email/approve'"
    );
    expect(src).toContain('function renderJoinRequestDecisionButtons(');
    expect(src).toContain('function renderJoinRequestResultPage(');
    expect(slice).not.toContain('<form method="POST"');
  });

  it('consumes league approval tokens only after approveOrganization completes', () => {
    const slice = sliceBetween(
      'async function approveLeagueHandler',
      "organizationsRouter.get('/:id/reject'"
    );
    expect(slice.indexOf('const result = await approveOrganization')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const result = await approveOrganization')
    );
  });

  it('prevents stale league email links from reversing the opposite final state', () => {
    expect(src).toContain('function describeLeagueEmailReviewState(');
    expect(src).toContain(
      "const currentState = orgInfo ? describeLeagueEmailReviewState(orgInfo, 'approve') : null;"
    );
    expect(src).toContain(
      "const currentState = orgInfo ? describeLeagueEmailReviewState(orgInfo, 'reject') : null;"
    );
    expect(src).toContain("title: 'Already Rejected'");
    expect(src).toContain("title: 'Already Approved'");
  });

  it('consumes league rejection tokens only after rejectOrganization completes', () => {
    const slice = sliceBetween(
      'async function rejectLeagueHandler',
      '// Legacy path used by the mobile app'
    );
    expect(slice.indexOf('const result = await rejectOrganization')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const result = await rejectOrganization')
    );
  });
});
