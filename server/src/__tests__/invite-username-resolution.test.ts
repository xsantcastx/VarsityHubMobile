/**
 * Invite by username OR email (2026-07-06 notes): a team admin can invite an
 * existing user by their username, and the server resolves it to that user's
 * canonical account email so no duplicate account is ever spawned for someone
 * already on VarsityHub. Email invites keep working unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Invite by username or email', () => {
  let ownerId = '';
  let ownerToken = '';
  let targetId = '';
  const targetUsername = `invitee${ts}`.slice(0, 20);
  const targetEmail = `invite-target-${ts}@example.com`;
  let orgId = '';
  let teamId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const owner = await prisma.user.create({
      data: {
        email: `invite-owner-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Invite Owner',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    ownerId = owner.id;
    ownerToken = signJwt({ id: owner.id });

    const target = await prisma.user.create({
      data: {
        email: targetEmail,
        password_hash: passwordHash,
        display_name: 'Invite Target',
        username: targetUsername,
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    targetId = target.id;

    const org = await prisma.organization.create({
      data: {
        name: `Invite Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: ownerId,
      },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: ownerId, role: 'owner', status: 'active' },
    });

    const team = await prisma.team.create({
      data: { name: `Invite Team ${ts}`, organization_id: orgId },
    });
    teamId = team.id;
    await prisma.teamMembership.create({
      data: { team_id: teamId, user_id: ownerId, role: 'owner', status: 'active' },
    });
  });

  afterAll(async () => {
    const ids = [ownerId, targetId].filter(Boolean);
    try {
      await prisma.teamInvite.deleteMany({ where: { team_id: teamId } }).catch(() => {});
      await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
      await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
      await prisma.organizationMembership
        .deleteMany({ where: { organization_id: orgId } })
        .catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  it('resolves a username invite to the target account email', async () => {
    const res = await request(app)
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ username: targetUsername, role: 'player' });
    expect(res.status).toBe(201);

    const invite = await prisma.teamInvite.findFirst({
      where: { team_id: teamId, email: { equals: targetEmail, mode: 'insensitive' } },
    });
    expect(invite).toBeTruthy();
    expect(invite.email.toLowerCase()).toBe(targetEmail.toLowerCase());
  });

  it('rejects an unknown username with 404', async () => {
    await request(app)
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ username: `nobody${ts}`, role: 'player' })
      .expect(404);
  });

  it('rejects an invite with neither email nor username (400)', async () => {
    await request(app)
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'player' })
      .expect(400);
  });

  it('still accepts a plain email invite (regression)', async () => {
    const res = await request(app)
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `plain-email-${ts}@example.com`, role: 'member' });
    expect(res.status).toBe(201);
  });
});
