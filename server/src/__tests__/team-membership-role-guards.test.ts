/**
 * Role-tier + sole-owner guards on the team-membership write paths
 * (2026-07-09). Two gaps the barrier suites did not cover:
 *
 *  S1 — POST /team-memberships gated canAdministerTeam (owner OR head coach) but
 *       never canAssignTeamRole, so a head COACH could add a user directly as
 *       `manager` — exactly what canAssignTeamRole (owner-only for manager) is
 *       meant to prevent, and what PATCH / teams-invite / team-invites already
 *       enforce.
 *  S2 — PATCH /:id and the POST upsert had no sole-owner guard (DELETE did), so
 *       a caller could demote/overwrite the only owner, leaving the team with no
 *       active owner and transfer-ownership permanently 403-ing.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('team-membership role-tier + sole-owner guards', () => {
  let ownerId = '';
  let coachId = '';
  let targetId = '';
  let managerId = '';
  let ownerToken = '';
  let coachToken = '';
  let managerToken = '';
  let orgId = '';
  let teamId = '';
  let ownerMembershipId = '';

  const mkUser = async (label: string, role: string) => {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    return prisma.user.create({
      data: {
        email: `tm-guard-${label}-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: `TM Guard ${label}`,
        email_verified: true,
        role,
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role, plan: 'rookie', onboarding_completed: true },
        ...(role === 'coach' ? { coach_agreement_accepted_at: new Date().toISOString() } : {}),
      },
    });
  };

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const owner = await mkUser('owner', 'coach');
    ownerId = owner.id;
    ownerToken = signJwt({ id: owner.id });

    const coach = await mkUser('coach', 'coach');
    coachId = coach.id;
    coachToken = signJwt({ id: coach.id });

    const target = await mkUser('target', 'fan');
    targetId = target.id;

    const org = await prisma.organization.create({
      data: {
        name: `TM Guard Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: owner.id,
      },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active' },
    });

    const team = await prisma.team.create({
      data: { name: `TM Guard Team ${ts}`, organization_id: org.id },
    });
    teamId = team.id;

    const ownerMembership = await prisma.teamMembership.create({
      data: { team_id: team.id, user_id: owner.id, role: 'owner', status: 'active' },
    });
    ownerMembershipId = ownerMembership.id;

    // A head coach with FULL-ADMIN access (passes canAdministerTeam) but who is
    // NOT the owner — the actor that must be blocked from assigning `manager`.
    await prisma.teamMembership.create({
      data: { team_id: team.id, user_id: coach.id, role: 'coach', status: 'active' },
    });

    // A team MANAGER — staff tier (can_manage) but NOT administer tier.
    const manager = await mkUser('manager', 'coach');
    managerId = manager.id;
    managerToken = signJwt({ id: manager.id });
    await prisma.teamMembership.create({
      data: { team_id: team.id, user_id: manager.id, role: 'manager', status: 'active' },
    });
  });

  afterAll(async () => {
    const ids = [ownerId, coachId, managerId, targetId].filter(Boolean);
    await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: orgId } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  });

  // ── S1 ──────────────────────────────────────────────────────────────────
  it('blocks a head coach from adding a user as manager (canAssignTeamRole)', async () => {
    const res = await request(app)
      .post('/team-memberships')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ team_id: teamId, user_id: targetId, role: 'manager' })
      .expect(403);
    expect(res.body.error).toBe('INSUFFICIENT_ROLE');
    const created = await prisma.teamMembership.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: targetId } },
    });
    expect(created).toBeNull();
  });

  it('still lets a head coach add a non-manager staffer (the barrier only blocks manager)', async () => {
    await request(app)
      .post('/team-memberships')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ team_id: teamId, user_id: targetId, role: 'assistant_coach' })
      .expect(201);
    await prisma.teamMembership
      .deleteMany({ where: { team_id: teamId, user_id: targetId } })
      .catch(() => {});
  });

  // ── S2 ──────────────────────────────────────────────────────────────────
  it('blocks demoting the sole owner via PATCH (would strand the team ownerless)', async () => {
    const res = await request(app)
      .patch(`/team-memberships/${ownerMembershipId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'coach' })
      .expect(400);
    expect(res.body.error).toBe('SOLE_OWNER');
    const still = await prisma.teamMembership.findUnique({ where: { id: ownerMembershipId } });
    expect(still.role).toBe('owner');
  });

  it('blocks archiving the sole owner via PATCH', async () => {
    const res = await request(app)
      .patch(`/team-memberships/${ownerMembershipId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'archived' })
      .expect(400);
    expect(res.body.error).toBe('SOLE_OWNER');
    const still = await prisma.teamMembership.findUnique({ where: { id: ownerMembershipId } });
    expect(still.status).toBe('active');
  });

  // ── admin-summary tier flags (drives client button gating) ────────────────
  it('exposes can_administer=true for the owner and head coach, false for a manager', async () => {
    const forOwner = await request(app)
      .get(`/teams/${teamId}/admin-summary`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(forOwner.body.permissions.can_administer).toBe(true);
    expect(forOwner.body.permissions.can_transfer).toBe(true);
    expect(forOwner.body.team.can_administer_team).toBe(true);

    const forCoach = await request(app)
      .get(`/teams/${teamId}/admin-summary`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);
    expect(forCoach.body.permissions.can_administer).toBe(true);

    const forManager = await request(app)
      .get(`/teams/${teamId}/admin-summary`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    // The manager is staff (can view the summary) but NOT administer tier — this
    // is exactly the flag the client uses to hide add/archive/invite/settings.
    expect(forManager.body.permissions.can_manage).toBe(true);
    expect(forManager.body.permissions.can_administer).toBe(false);
    expect(forManager.body.permissions.can_transfer).toBe(false);
    expect(forManager.body.team.can_administer_team).toBe(false);
  });

  // ── screen-summary tier flags (team-page Edit-profile button gates on these) ──
  it('screen-summary exposes can_administer=true for owner/coach, false for a manager', async () => {
    // team-page.tsx gates the Edit-profile button (→ /edit-team, administer-only)
    // on this flag. Before it was added, team-page fell back to the staff-tier
    // can_manage, so a manager saw "Edit profile" then got bounced with 403.
    const forOwner = await request(app)
      .get(`/teams/${teamId}/screen-summary`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(forOwner.body.permissions.can_manage).toBe(true);
    expect(forOwner.body.permissions.can_administer).toBe(true);

    const forCoach = await request(app)
      .get(`/teams/${teamId}/screen-summary`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);
    expect(forCoach.body.permissions.can_administer).toBe(true);

    const forManager = await request(app)
      .get(`/teams/${teamId}/screen-summary`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(forManager.body.permissions.can_manage).toBe(true);
    expect(forManager.body.permissions.can_administer).toBe(false);
  });

  it('DELETE cannot remove the last ACTIVE owner even when an archived owner row exists', async () => {
    // Seed a second, ARCHIVED owner — a non-functional row. The sole-owner guard
    // must count only ACTIVE owners; counting the archived one would let the last
    // active owner be removed, leaving the team ownerless (transfer then 403s).
    const ghost = await mkUser('ghost-owner', 'coach');
    const archived = await prisma.teamMembership.create({
      data: { team_id: teamId, user_id: ghost.id, role: 'owner', status: 'archived' },
    });
    try {
      const res = await request(app)
        .delete(`/team-memberships/${ownerMembershipId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
      expect(res.body.error).toBe('SOLE_OWNER');
      const still = await prisma.teamMembership.findUnique({ where: { id: ownerMembershipId } });
      expect(still?.status).toBe('active');
    } finally {
      await prisma.teamMembership.delete({ where: { id: archived.id } });
      await prisma.user.delete({ where: { id: ghost.id } });
    }
  });
});
