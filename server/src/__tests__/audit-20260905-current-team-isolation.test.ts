/** Current-source audit: real HTTP, JWT middleware and isolated PostgreSQL.
 * Assertions express intended boundaries. Audit failures are evidence, not fixes.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

const database = new URL(process.env.DATABASE_URL || '');
if (
  process.env.NODE_ENV !== 'test' ||
  !['127.0.0.1', 'localhost'].includes(database.hostname) ||
  !database.pathname.startsWith('/varsityhub_audit_')
) {
  throw new Error('Current team audit requires a disposable local varsityhub_audit_ database');
}
const { app } = await import('../testApp.js');
const { prisma } = await import('../lib/prisma.js');
const { signJwt } = await import('../lib/jwt.js');

const prefix = `rolecurrent${Date.now()}`;
const userIds: string[] = [];
const orgIds: string[] = [];
const teamIds: string[] = [];
let sequence = 0;

async function actor(label: string, role: 'fan' | 'coach' = 'coach') {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}${++sequence}@example.com`,
      username: `rc${String(Date.now()).slice(-9)}${sequence}`,
      display_name: label,
      password_hash: 'unused-local-audit',
      email_verified: true,
      role,
      onboarding_completed: true,
      approval_status: 'APPROVED',
      date_of_birth: new Date('1990-01-01'),
      coach_agreement_accepted_at: new Date(),
      coach_agreement_version: 1,
      preferences: { role, onboarding_completed: true },
    },
  });
  userIds.push(user.id);
  return { ...user, token: signJwt({ id: user.id }) };
}

async function organization(ownerId: string, legacy = false, approved = true) {
  const org = await prisma.organization.create({
    data: {
      name: `${prefix} Organization ${++sequence}`,
      league_owner_id: ownerId,
      admin_approved: approved,
      status: 'active',
    },
  });
  orgIds.push(org.id);
  if (!legacy) {
    await prisma.organizationMembership.create({
      data: { organization_id: org.id, user_id: ownerId, role: 'owner', status: 'active' },
    });
  }
  return org;
}

async function team(orgId: string, coachId?: string) {
  const row = await prisma.team.create({
    data: { name: `${prefix} Team ${++sequence}`, organization_id: orgId, status: 'active' },
  });
  teamIds.push(row.id);
  if (coachId) {
    await prisma.teamMembership.create({
      data: { team_id: row.id, user_id: coachId, role: 'coach', status: 'active' },
    });
  }
  return row;
}

function gamePayload(teamId: string) {
  return {
    title: `${prefix} Game ${++sequence}`,
    home_team_id: teamId,
    date: new Date(Date.now() + 86_400_000).toISOString(),
    location: 'Local audit field',
    latitude: 40.7,
    longitude: -74,
  };
}

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.adminActivityLog.deleteMany({ where: { admin_id: { in: userIds } } });
  await prisma.event.deleteMany({ where: { creator_id: { in: userIds } } });
  await prisma.game.deleteMany({ where: { created_by_id: { in: userIds } } });
  await prisma.teamMembership.deleteMany({ where: { team_id: { in: teamIds } } });
  await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.organizationMembership.deleteMany({ where: { organization_id: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe('current team boundary matrix', () => {
  let owner: Awaited<ReturnType<typeof actor>>;
  let coach: Awaited<ReturnType<typeof actor>>;
  let otherCoach: Awaited<ReturnType<typeof actor>>;
  let orgManager: Awaited<ReturnType<typeof actor>>;
  let fan: Awaited<ReturnType<typeof actor>>;
  let ownTeam: Awaited<ReturnType<typeof team>>;
  let siblingTeam: Awaited<ReturnType<typeof team>>;
  let foreignTeam: Awaited<ReturnType<typeof team>>;

  beforeAll(async () => {
    owner = await actor('Organization owner');
    coach = await actor('Coach A');
    otherCoach = await actor('Coach B');
    orgManager = await actor('Organization manager');
    fan = await actor('Fan', 'fan');
    const org = await organization(owner.id);
    await prisma.organizationMembership.createMany({
      data: [
        { organization_id: org.id, user_id: coach.id, role: 'member', status: 'active' },
        { organization_id: org.id, user_id: orgManager.id, role: 'manager', status: 'active' },
      ],
    });
    ownTeam = await team(org.id, coach.id);
    siblingTeam = await team(org.id, otherCoach.id);
    const foreignOrg = await organization(otherCoach.id);
    foreignTeam = await team(foreignOrg.id, otherCoach.id);
  });

  it('R01 coach edits own team; same-org sibling and foreign team survive attempted edits', async () => {
    await request(app)
      .put(`/teams/${ownTeam.id}`)
      .set('Authorization', `Bearer ${coach.token}`)
      .send({ description: 'Permitted own-team edit' })
      .expect(200);
    for (const target of [siblingTeam, foreignTeam]) {
      await request(app)
        .put(`/teams/${target.id}`)
        .set('Authorization', `Bearer ${coach.token}`)
        .send({ description: 'Unauthorized edit' })
        .expect(403);
      expect((await prisma.team.findUnique({ where: { id: target.id } }))?.description).toBeNull();
      await request(app)
        .get(`/teams/${target.id}/admin-summary`)
        .set('Authorization', `Bearer ${coach.token}`)
        .expect(403);
    }
  });

  it('single and bulk fan submissions share draft lifecycle and the pending cap', async () => {
    await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${fan.token}`)
      .send(gamePayload(ownTeam.id))
      .expect(201);
    await request(app)
      .post('/games/bulk')
      .set('Authorization', `Bearer ${fan.token}`)
      .send({ games: [gamePayload(ownTeam.id), gamePayload(ownTeam.id)] })
      .expect(201);
    const games = await prisma.game.findMany({
      where: { created_by_id: fan.id },
      include: { events: true },
      take: 10,
    });
    expect(games).toHaveLength(3);
    for (const game of games) {
      expect(game.approval_status).toBe('pending');
      expect(game.events).toEqual([
        expect.objectContaining({ status: 'draft', approval_status: 'pending' }),
      ]);
    }
    for (const route of ['/games', '/games/bulk']) {
      const payload = gamePayload(ownTeam.id);
      const result = await request(app)
        .post(route)
        .set('Authorization', `Bearer ${fan.token}`)
        .send(route.endsWith('bulk') ? { games: [payload] } : payload);
      expect(result.status).toBe(403);
      expect(result.body.code).toBe('EVENT_LIMIT_EXCEEDED');
    }
    expect(await prisma.game.count({ where: { created_by_id: fan.id } })).toBe(3);
  });

  it('bulk rejects a missing team in any row without writing partial games', async () => {
    const before = await prisma.game.count({ where: { created_by_id: coach.id } });
    await request(app)
      .post('/games/bulk')
      .set('Authorization', `Bearer ${coach.token}`)
      .send({
        games: [gamePayload(ownTeam.id), { ...gamePayload(ownTeam.id), home_team_id: undefined }],
      })
      .expect(400);
    expect(await prisma.game.count({ where: { created_by_id: coach.id } })).toBe(before);
  });

  it('R03 org owner administers both own-org teams but cannot foreign team; manager cannot edit', async () => {
    for (const target of [ownTeam, siblingTeam]) {
      await request(app)
        .put(`/teams/${target.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ description: 'Organization owner edit' })
        .expect(200);
      await request(app)
        .put(`/teams/${target.id}`)
        .set('Authorization', `Bearer ${orgManager.token}`)
        .send({ description: 'Unauthorized manager edit' })
        .expect(403);
    }
    await request(app)
      .put(`/teams/${foreignTeam.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ description: 'Foreign owner edit' })
      .expect(403);
  });

  it('R01 fan cannot edit or read team administration in any organization', async () => {
    for (const target of [ownTeam, siblingTeam, foreignTeam]) {
      await request(app)
        .put(`/teams/${target.id}`)
        .set('Authorization', `Bearer ${fan.token}`)
        .send({ description: 'Fan edit' })
        .expect(403);
      await request(app)
        .get(`/teams/${target.id}/admin-summary`)
        .set('Authorization', `Bearer ${fan.token}`)
        .expect(403);
    }
  });

  it('R06 mixed own/foreign bulk creation approves only managed rows', async () => {
    const res = await request(app)
      .post('/games/bulk')
      .set('Authorization', `Bearer ${coach.token}`)
      .send({ games: [gamePayload(ownTeam.id), gamePayload(foreignTeam.id)] })
      .expect(201);
    const rows = await prisma.game.findMany({
      where: { id: { in: res.body.games.map((g: { id: string }) => g.id) } },
      select: { home_team_id: true, approval_status: true },
      take: 2,
    });
    expect(rows.find(row => row.home_team_id === ownTeam.id)?.approval_status).toBe('approved');
    expect(rows.find(row => row.home_team_id === foreignTeam.id)?.approval_status).toBe('pending');
  });

  it('R06 opponent staff cannot delete shared game or overwrite creator-side scores', async () => {
    const payload = gamePayload(ownTeam.id);
    const row = await prisma.game.create({
      data: {
        title: payload.title,
        date: new Date(payload.date),
        home_team_id: ownTeam.id,
        away_team_id: foreignTeam.id,
        created_by_id: coach.id,
        approval_status: 'approved',
        opponent_approval_team_id: foreignTeam.id,
        opponent_approval_status: 'approved',
      },
    });
    await request(app)
      .delete(`/games/${row.id}`)
      .set('Authorization', `Bearer ${otherCoach.token}`)
      .expect(403);
    await request(app)
      .patch(`/games/${row.id}/result`)
      .set('Authorization', `Bearer ${otherCoach.token}`)
      .send({ home_score: 99 })
      .expect(403);
    expect((await prisma.game.findUnique({ where: { id: row.id } }))?.home_score).toBeNull();
    await request(app)
      .patch(`/games/${row.id}/result`)
      .set('Authorization', `Bearer ${coach.token}`)
      .send({ home_score: 2 })
      .expect(200);
  });

  it('R01 removing coach membership revokes next-request settings and admin-summary access', async () => {
    const removed = await actor('Removed coach');
    const target = await team(ownTeam.organization_id!, removed.id);
    const membership = await prisma.teamMembership.findUniqueOrThrow({
      where: { team_id_user_id: { team_id: target.id, user_id: removed.id } },
    });
    await request(app)
      .put(`/teams/${target.id}`)
      .set('Authorization', `Bearer ${removed.token}`)
      .send({ description: 'Before removal' })
      .expect(200);
    await request(app)
      .delete(`/team-memberships/${membership.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    await request(app)
      .put(`/teams/${target.id}`)
      .set('Authorization', `Bearer ${removed.token}`)
      .send({ description: 'After removal' })
      .expect(403);
    await request(app)
      .get(`/teams/${target.id}/admin-summary`)
      .set('Authorization', `Bearer ${removed.token}`)
      .expect(403);
    expect((await prisma.team.findUnique({ where: { id: target.id } }))?.description).toBe(
      'Before removal'
    );
  });

  it('R16 unapproved organization cannot bypass single-game rejection via bulk endpoint', async () => {
    const pendingOwner = await actor('Unapproved organization owner');
    const org = await organization(pendingOwner.id, false, false);
    const target = await team(org.id, pendingOwner.id);
    const payload = gamePayload(target.id);
    await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${pendingOwner.token}`)
      .send(payload)
      .expect(403);
    const bulk = await request(app)
      .post('/games/bulk')
      .set('Authorization', `Bearer ${pendingOwner.token}`)
      .send({ games: [payload] });
    const persisted = await prisma.game.findMany({
      where: { created_by_id: pendingOwner.id },
      select: { approval_status: true },
      take: 10,
    });
    expect({ status: bulk.status, persisted }).toEqual({ status: 403, persisted: [] });
  });

  it('R17 legacy pointer-only owner can open administration for the team they can edit', async () => {
    const legacyOwner = await actor('Legacy organization owner');
    const org = await organization(legacyOwner.id, true);
    const target = await team(org.id);
    await request(app)
      .put(`/teams/${target.id}`)
      .set('Authorization', `Bearer ${legacyOwner.token}`)
      .send({ description: 'Legacy owner valid edit' })
      .expect(200);
    const summary = await request(app)
      .get(`/teams/${target.id}/admin-summary`)
      .set('Authorization', `Bearer ${legacyOwner.token}`);
    expect({
      status: summary.status,
      canAdminister: summary.body.permissions?.can_administer,
    }).toEqual({ status: 200, canAdminister: true });
  });
});
