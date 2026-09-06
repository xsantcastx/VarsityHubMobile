/**
 * Security regression scenarios, including the original before-fix reproductions. Real Express HTTP + local PostgreSQL.
 * Run with a disposable DB, VARSITYHUB_ENV_PATH=/dev/null and
 * DOTENV_CONFIG_PATH=/dev/null; never use production credentials.
 * Assertions describe the intended authorization boundary.
 */
import { afterAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

const auditDatabaseUrl = new URL(process.env.DATABASE_URL || '');
if (
  process.env.NODE_ENV !== 'test' ||
  !['127.0.0.1', 'localhost'].includes(auditDatabaseUrl.hostname) ||
  !auditDatabaseUrl.pathname.startsWith('/varsityhub_audit_')
) {
  throw new Error('Role audit requires a dedicated local varsityhub_audit_ database');
}

// The transfer/review race needs two transactions plus a lock observer.
// Most server tests intentionally use one connection; this isolated suite needs five.
auditDatabaseUrl.searchParams.set('connection_limit', '5');
process.env.DATABASE_URL = auditDatabaseUrl.toString();
const { app } = await import('../testApp.js');
const { prisma } = await import('../lib/prisma.js');
const { signJwt } = await import('../lib/jwt.js');
const { signReviewToken } = await import('../lib/reviewTokens.js');
const { getOrganizationOwner, getOwnedOrganizationIds } =
  await import('../lib/organizationAuthorization.js');
const { buildCoachJoinRequestReviewUrl } = await import('../lib/email.js');
const { getOrganizationJoinRequestState } = await import('../lib/organizationWorkflowState.js');

const prefix = `auditroles${Date.now()}`;
const users: string[] = [];
const orgs: string[] = [];
let sequence = 0;

async function user(label: string) {
  sequence += 1;
  const row = await prisma.user.create({
    data: {
      email: `${prefix}-${sequence}@example.com`,
      username: `ar${String(Date.now()).slice(-10)}${sequence}`,
      display_name: label,
      password_hash: 'audit-only-unused-password-hash',
      email_verified: true,
      role: 'coach',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      date_of_birth: new Date('1990-01-01'),
      coach_agreement_accepted_at: new Date(),
      coach_agreement_version: 1,
      preferences: { role: 'coach', onboarding_completed: true },
    },
  });
  users.push(row.id);
  return { ...row, token: signJwt({ id: row.id }) };
}

async function fixture(legacy = false) {
  const owner = await user('Original Owner');
  const successor = await user('Successor');
  const coach = await user('Applicant');
  const org = await prisma.organization.create({
    data: {
      name: `${prefix}-${sequence}`,
      league_owner_id: owner.id,
      admin_approved: true,
      status: 'active',
    },
  });
  orgs.push(org.id);
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: successor.id, role: 'member', status: 'active' },
  });
  if (!legacy) {
    await prisma.organizationMembership.create({
      data: { organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active' },
    });
  }
  await prisma.user.update({ where: { id: owner.id }, data: { organization_id: org.id } });
  const join = await prisma.organizationJoinRequest.create({
    data: { organization_id: org.id, user_id: coach.id, status: 'pending' },
  });
  const url = new URL(
    buildCoachJoinRequestReviewUrl({
      organizationId: org.id,
      requestId: join.id,
      reviewerUserId: owner.id,
      requestCreatedAt: join.created_at,
      action: 'approve',
    })
  );
  return { owner, successor, coach, org, join, emailPath: url.pathname + url.search };
}

function reviewPath(f: Awaited<ReturnType<typeof fixture>>, action: 'approve' | 'reject') {
  const url = new URL(
    buildCoachJoinRequestReviewUrl({
      organizationId: f.org.id,
      requestId: f.join.id,
      reviewerUserId: f.owner.id,
      requestCreatedAt: f.join.created_at,
      action,
    })
  );
  return url.pathname + url.search;
}

async function decisionEffects(f: Awaited<ReturnType<typeof fixture>>) {
  const [audit, notifications] = await Promise.all([
    prisma.adminActivityLog.count({
      where: {
        target_id: f.coach.id,
        action: { in: ['APPROVE_JOIN_REQUEST', 'DENY_JOIN_REQUEST'] },
      },
    }),
    prisma.notification.count({
      where: {
        user_id: f.coach.id,
        type: { in: ['JOIN_REQUEST_APPROVED', 'JOIN_REQUEST_DENIED'] },
      },
    }),
  ]);
  return { audit, notifications };
}

async function reapply(f: Awaited<ReturnType<typeof fixture>>) {
  const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  await prisma.organizationJoinRequest.update({
    where: { id: f.join.id },
    data: { reviewed_at: past },
  });
  await prisma.user.update({ where: { id: f.coach.id }, data: { rejected_at: past } });
  await request(app)
    .post('/organizations/join-requests')
    .set('Authorization', `Bearer ${f.coach.token}`)
    .send({ organization_id: f.org.id })
    .expect(201);
}

afterAll(async () => {
  await prisma.adminActivityLog.deleteMany({
    where: { OR: [{ admin_id: { in: users } }, { target_id: { in: [...users, ...orgs] } }] },
  });
  await prisma.notification.deleteMany({ where: { user_id: { in: users } } });
  await prisma.organizationJoinRequest.deleteMany({ where: { organization_id: { in: orgs } } });
  await prisma.organizationMembership.deleteMany({ where: { organization_id: { in: orgs } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe('audit 2026-09-05 organization email authority', () => {
  it('control: ordinary coach and organization owner cannot read founder metrics', async () => {
    const f = await fixture();
    for (const actor of [f.owner, f.successor, f.coach]) {
      await request(app)
        .get('/admin/metrics')
        .set('Authorization', `Bearer ${actor.token}`)
        .expect(403);
    }
    await request(app).get('/admin/metrics').expect(401);
  });

  it('control: founder metric access requires the verified allowlisted mailbox', async () => {
    const founder = await user('Founder');
    await prisma.user.update({
      where: { id: founder.id },
      data: { email: 'emancero@varsityhub.app' },
    });
    await request(app)
      .get('/admin/metrics')
      .set('Authorization', `Bearer ${founder.token}`)
      .expect(200);
    await prisma.user.update({ where: { id: founder.id }, data: { email_verified: false } });
    await request(app)
      .get('/admin/metrics')
      .set('Authorization', `Bearer ${founder.token}`)
      .expect(403);
  });

  it('policy evidence: the verified App Store demo account also receives founder metric access', async () => {
    const demo = await user('App Store Demo');
    await prisma.user.update({
      where: { id: demo.id },
      data: { email: 'demo@varsityhub.app' },
    });
    await request(app)
      .get('/admin/metrics')
      .set('Authorization', `Bearer ${demo.token}`)
      .expect(200);
  });

  it('control: current owner may review a coach request via the real signed email link', async () => {
    const f = await fixture();
    await request(app).get(f.emailPath).expect(200);
    expect((await getOrganizationJoinRequestState(f.join.id))?.status).toBe('approved');
    expect(await decisionEffects(f)).toEqual({ audit: 1, notifications: 1 });
  });

  it('control: a different organization owner cannot review this organization via the app', async () => {
    const f = await fixture();
    const other = await fixture();
    await request(app)
      .post(`/organizations/join-requests/${f.join.id}/approve`)
      .set('Authorization', `Bearer ${other.owner.token}`)
      .send({})
      .expect(403);
    expect((await getOrganizationJoinRequestState(f.join.id))?.status).toBe('pending');
  });

  it('regression: transferred-out owner must lose authority to use their old email link', async () => {
    const f = await fixture();
    await request(app)
      .post(`/organizations/${f.org.id}/transfer-ownership`)
      .set('Authorization', `Bearer ${f.owner.token}`)
      .send({ new_owner_id: f.successor.id })
      .expect(200);
    // The signed-in path correctly rejects the former owner after the transfer.
    await request(app)
      .post(`/organizations/join-requests/${f.join.id}/approve`)
      .set('Authorization', `Bearer ${f.owner.token}`)
      .send({})
      .expect(403);
    const response = await request(app).get(f.emailPath);
    const state = await getOrganizationJoinRequestState(f.join.id);
    expect({
      status: response.status,
      requestStatus: state?.status,
      reviewedBy: state?.reviewed_by,
    }).toEqual({ status: 403, requestStatus: 'pending', reviewedBy: null });
  });

  it('regression: legacy pointer-only owner must retain the same email-review access as app access', async () => {
    const f = await fixture(true);
    await request(app)
      .get(`/organizations/${f.org.id}/join-requests`)
      .set('Authorization', `Bearer ${f.owner.token}`)
      .expect(200);
    const response = await request(app).get(f.emailPath);
    expect({
      status: response.status,
      requestStatus: (await getOrganizationJoinRequestState(f.join.id))?.status,
    }).toEqual({ status: 200, requestStatus: 'approved' });
  });

  it('regression: consumed email token must not mutate a re-opened request before returning replay error', async () => {
    const f = await fixture();
    const rejectUrl = new URL(
      buildCoachJoinRequestReviewUrl({
        organizationId: f.org.id,
        requestId: f.join.id,
        reviewerUserId: f.owner.id,
        requestCreatedAt: f.join.created_at,
        action: 'reject',
      })
    );
    const path = rejectUrl.pathname + rejectUrl.search;
    await request(app).get(path).expect(200);
    // Model the documented 7-day cooldown passing while the 30-day link lives.
    await prisma.organizationJoinRequest.update({
      where: { id: f.join.id },
      data: { reviewed_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });
    await prisma.user.update({
      where: { id: f.coach.id },
      data: { rejected_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });
    await request(app)
      .post('/organizations/join-requests')
      .set('Authorization', `Bearer ${f.coach.token}`)
      .send({ organization_id: f.org.id })
      .expect(201);
    expect((await getOrganizationJoinRequestState(f.join.id))?.status).toBe('pending');
    const replay = await request(app).get(path);
    const state = await getOrganizationJoinRequestState(f.join.id);
    expect({ status: replay.status, requestStatus: state?.status }).toEqual({
      status: 409,
      requestStatus: 'pending',
    });
  });
  it('an unused link cannot decide a newer application attempt', async () => {
    const f = await fixture();
    await request(app)
      .post(`/organizations/join-requests/${f.join.id}/deny`)
      .set('Authorization', `Bearer ${f.owner.token}`)
      .send({})
      .expect(200);
    await reapply(f);
    const before = await decisionEffects(f);
    await request(app).get(f.emailPath).expect(409);
    expect((await getOrganizationJoinRequestState(f.join.id))?.status).toBe('pending');
    expect(await decisionEffects(f)).toEqual(before);
  });

  it('transfer-back cannot resurrect an earlier ownership term link', async () => {
    const f = await fixture();
    for (const [actor, successor] of [
      [f.owner, f.successor],
      [f.successor, f.owner],
    ]) {
      await request(app)
        .post(`/organizations/${f.org.id}/transfer-ownership`)
        .set('Authorization', `Bearer ${actor.token}`)
        .send({ new_owner_id: successor.id })
        .expect(200);
    }
    await request(app).get(f.emailPath).expect(409);
    expect((await getOrganizationJoinRequestState(f.join.id))?.status).toBe('pending');
    expect(await decisionEffects(f)).toEqual({ audit: 0, notifications: 0 });
  });

  it('rejects pre-fix unbound tokens with actionable app recovery', async () => {
    const f = await fixture();
    const token = signReviewToken({
      requestId: f.join.id,
      orgId: f.org.id,
      action: 'approve_join_request',
    });
    const response = await request(app)
      .get(`/organizations/join-requests/${f.join.id}/email/approve?token=${token}`)
      .expect(401);
    expect(response.text).toContain('Open VarsityHub');
    expect((await getOrganizationJoinRequestState(f.join.id))?.status).toBe('pending');
    expect(await decisionEffects(f)).toEqual({ audit: 0, notifications: 0 });
  });

  it('concurrent approve/reject links commit one decision and one set of effects', async () => {
    const f = await fixture();
    const responses = await Promise.all([
      request(app).get(f.emailPath),
      request(app).get(reviewPath(f, 'reject')),
      request(app).get(f.emailPath),
      request(app).get(reviewPath(f, 'reject')),
    ]);
    expect(responses.some(response => response.status === 200)).toBe(true);
    for (const response of responses) expect([200, 400, 409, 503]).toContain(response.status);
    const state = await getOrganizationJoinRequestState(f.join.id);
    expect(['approved', 'denied']).toContain(state?.status);
    expect(state?.reviewed_by).toBe(f.owner.id);
    expect(await decisionEffects(f)).toEqual({ audit: 1, notifications: 1 });
    // Retry after the winning commit renders its state, never creates effects.
    await request(app).get(f.emailPath).expect(200);
    expect(await decisionEffects(f)).toEqual({ audit: 1, notifications: 1 });
  });

  it('an ownership transfer that commits while review waits revokes the old reviewer', async () => {
    const f = await fixture();
    const transaction = prisma.$transaction.bind(prisma);
    let ready!: () => void;
    let release!: () => void;
    const prepared = new Promise<void>(resolve => {
      ready = resolve;
    });
    const resume = new Promise<void>(resolve => {
      release = resolve;
    });
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce((async (
      callback: any
    ) => {
      return transaction(async tx => {
        const result = await callback(tx);
        ready();
        await resume;
        return result;
      });
    }) as any);
    const transfer = request(app)
      .post(`/organizations/${f.org.id}/transfer-ownership`)
      .set('Authorization', `Bearer ${f.owner.token}`)
      .send({ new_owner_id: f.successor.id })
      .then(response => response);
    await prepared;
    const review = request(app)
      .get(f.emailPath)
      .then(response => response);
    try {
      // Observe the real PostgreSQL row-lock wait before allowing transfer commit.
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const rows = await prisma.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS(SELECT 1 FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE '%Organization%FOR UPDATE%') AS waiting
        `;
        if (rows[0]?.waiting) {
          waiting = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
    } finally {
      release();
      spy.mockRestore();
    }
    expect((await transfer).status).toBe(200);
    expect([403, 409, 503]).toContain((await review).status);
    await request(app).get(f.emailPath).expect(403);
    expect((await getOrganizationJoinRequestState(f.join.id))?.status).toBe('pending');
    expect(await decisionEffects(f)).toEqual({ audit: 0, notifications: 0 });
  });

  it('legacy-owner recipient, app authority and audit actor use the same resolver', async () => {
    const f = await fixture(true);
    expect(await getOrganizationOwner(f.org.id)).toEqual({
      id: f.owner.id,
      email: f.owner.email,
      display_name: f.owner.display_name,
    });
    expect(await getOwnedOrganizationIds(f.owner.id, [f.org.id])).toEqual([f.org.id]);
    await request(app).get(f.emailPath).expect(200);
    expect((await getOrganizationJoinRequestState(f.join.id))?.reviewed_by).toBe(f.owner.id);
    expect(
      await prisma.adminActivityLog.findFirst({
        where: { target_id: f.coach.id, action: 'APPROVE_JOIN_REQUEST' },
      })
    ).toMatchObject({ admin_id: f.owner.id, admin_email: f.owner.email });
  });

  it('organization ownership does not grant founder event-post-access mutations', async () => {
    const f = await fixture();
    await request(app)
      .post('/admin/events/nonexistent-event/post-access')
      .set('Authorization', `Bearer ${f.owner.token}`)
      .send({ user_id: f.coach.id })
      .expect(403);
  });
});
