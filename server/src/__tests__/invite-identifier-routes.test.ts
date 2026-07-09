import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import { prisma } from '../lib/prisma.js';
import { signJwt } from '../lib/jwt.js';
import { createTestUser } from './helpers/createTestUser.js';

const PASSWORD = 'TestPassword123!';
const ts = Date.now();

describe('invite identifier routes', () => {
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdTeamIds: string[] = [];
  let ownerId = '';
  let ownerToken = '';
  let orgId = '';
  let teamId = '';
  let targetUserId = '';
  let targetEmail = '';
  let targetUsername = '';
  let existingMemberUserId = '';

  beforeAll(async () => {
    const owner = await createTestUser({
      prisma,
      signJwt,
      password: PASSWORD,
      email: `invite-owner-${ts}@example.com`,
      displayName: 'Invite Owner',
      role: 'coach',
      plan: 'rookie',
      username: `owner${ts}`.slice(0, 20),
    });
    ownerId = owner.id;
    ownerToken = owner.token;
    createdUserIds.push(owner.id);

    targetUsername = `invitee${ts}`.slice(0, 20);
    targetEmail = `invite-target-${ts}@example.com`;
    const target = await createTestUser({
      prisma,
      signJwt,
      password: PASSWORD,
      email: targetEmail,
      displayName: 'Invite Target',
      role: 'fan',
      username: targetUsername,
    });
    targetUserId = target.id;
    createdUserIds.push(target.id);

    const existingMember = await createTestUser({
      prisma,
      signJwt,
      password: PASSWORD,
      email: `invite-existing-${ts}@example.com`,
      displayName: 'Existing Member',
      role: 'fan',
      username: `member${ts}`.slice(0, 20),
    });
    existingMemberUserId = existingMember.id;
    createdUserIds.push(existingMember.id);

    const org = await prisma.organization.create({
      data: {
        name: `Invite Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: owner.id,
      },
    });
    orgId = org.id;
    createdOrgIds.push(org.id);

    await prisma.organizationMembership.createMany({
      data: [
        { organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active' },
        {
          organization_id: org.id,
          user_id: existingMember.id,
          role: 'member',
          status: 'active',
        },
      ],
    });

    const team = await prisma.team.create({
      data: {
        name: `Invite Team ${ts}`,
        organization_id: org.id,
      },
    });
    teamId = team.id;
    createdTeamIds.push(team.id);

    await prisma.teamMembership.createMany({
      data: [
        { team_id: team.id, user_id: owner.id, role: 'owner', status: 'active' },
        { team_id: team.id, user_id: existingMember.id, role: 'member', status: 'active' },
      ],
    });
  });

  afterAll(async () => {
    if (createdTeamIds.length) {
      await prisma.teamInvite
        .deleteMany({ where: { team_id: { in: createdTeamIds } } })
        .catch(() => {});
      await prisma.teamMembership
        .deleteMany({ where: { team_id: { in: createdTeamIds } } })
        .catch(() => {});
      await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } }).catch(() => {});
    }
    if (createdOrgIds.length) {
      await prisma.organizationInvite
        .deleteMany({ where: { organization_id: { in: createdOrgIds } } })
        .catch(() => {});
      await prisma.organizationMembership
        .deleteMany({ where: { organization_id: { in: createdOrgIds } } })
        .catch(() => {});
      await prisma.organization
        .deleteMany({ where: { id: { in: createdOrgIds } } })
        .catch(() => {});
    }
    if (createdUserIds.length) {
      await prisma.refreshToken
        .deleteMany({ where: { user_id: { in: createdUserIds } } })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
  });

  it('resolves organization username invites to the user email and dedups by canonical email', async () => {
    const first = await request(app)
      .post(`/organizations/${orgId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ identifier: `@${targetUsername}`, role: 'assistant_coach' })
      .expect(201);

    const second = await request(app)
      .post(`/organizations/${orgId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ identifier: targetEmail.toUpperCase(), role: 'assistant_coach' })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    const invites = await prisma.organizationInvite.findMany({
      where: { organization_id: orgId, email: targetEmail.toLowerCase() },
      select: { email: true },
    });
    expect(invites).toHaveLength(1);
    expect(invites[0]?.email).toBe(targetEmail.toLowerCase());
  });

  it('keeps raw organization email invites for users without accounts', async () => {
    const email = `org-email-only-${ts}@example.com`;
    await request(app)
      .post(`/organizations/${orgId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ identifier: email, role: 'assistant_coach' })
      .expect(201);

    const invite = await prisma.organizationInvite.findFirst({
      where: { organization_id: orgId, email },
      select: { email: true },
    });
    expect(invite?.email).toBe(email);
  });

  it('rejects nonexistent organization usernames and existing organization members', async () => {
    await request(app)
      .post(`/organizations/${orgId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ identifier: '@does-not-exist-user', role: 'assistant_coach' })
      .expect(404);

    const member = await prisma.user.findUnique({
      where: { id: existingMemberUserId },
      select: { username: true },
    });

    const response = await request(app)
      .post(`/organizations/${orgId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ identifier: `@${member?.username}`, role: 'assistant_coach' })
      .expect(409);

    // buildErrorEnvelope(error, { code }) puts the machine-readable token in
    // `code`/`errorCode` and leaves `error` as user-facing prose. Clients switch
    // on `code`; asserting `error === 'ALREADY_MEMBER'` was asserting that we
    // render a raw enum to the user.
    expect(response.body.code).toBe('ALREADY_MEMBER');
    expect(response.body.error).toMatch(/already a member/i);
  });

  // NOTE: `identifier` is the ORGANIZATION invite contract (organizations.ts calls
  // resolveInviteIdentifier). The TEAM routes take `email | username` and the live
  // client splits before sending (api/entities.ts Team.invite). These tests were
  // copy-pasted from the org suite and posted `identifier` to team routes, which
  // fails the zod refine -> 400. Server and shipped client are correct; the tests
  // weren't. (The unused TeamInvites.create helper in api/entities.ts DOES send
  // `identifier` and would 400 — it has zero callers. Tracked separately.)
  it('supports team username and email invites across both public routes with canonical-email dedup', async () => {
    const first = await request(app)
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ username: targetUsername, role: 'assistant_coach' })
      .expect(201);

    const second = await request(app)
      .post('/team-invites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ team_id: teamId, email: targetEmail.toUpperCase(), role: 'assistant_coach' })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    const invites = await prisma.teamInvite.findMany({
      where: { team_id: teamId, email: targetEmail.toLowerCase() },
      select: { email: true },
    });
    expect(invites).toHaveLength(1);
  });

  it('keeps raw team email invites for users without accounts and rejects invalid usernames or existing members', async () => {
    const email = `team-email-only-${ts}@example.com`;
    await request(app)
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email, role: 'assistant_coach' })
      .expect(201);

    const invite = await prisma.teamInvite.findFirst({
      where: { team_id: teamId, email },
      select: { email: true },
    });
    expect(invite?.email).toBe(email);

    await request(app)
      .post('/team-invites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ team_id: teamId, username: 'does-not-exist-user', role: 'assistant_coach' })
      .expect(404);

    const member = await prisma.user.findUnique({
      where: { id: existingMemberUserId },
      select: { username: true },
    });

    const response = await request(app)
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ username: member?.username, role: 'assistant_coach' })
      .expect(409);

    // See the org-invite note above: `code` is the machine token, `error` is prose.
    expect(response.body.code).toBe('ALREADY_MEMBER');
    expect(response.body.error).toMatch(/already on this team/i);
  });
});
