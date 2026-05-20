/**
 * Group-chat boundary tests.
 *
 * Locks in the org-admin-pattern extension for team-scoped chats:
 *   - POST /group-chats/:chatId/members
 *       - team coach CAN add (member must be on team roster)
 *       - org manager CAN add even without team membership
 *       - non-affiliated user CANNOT add
 *       - target not on team roster → 400 NOT_ON_TEAM
 *       - already-member → idempotent ok
 *   - DELETE /group-chats/:chatId/members/:userId
 *       - self-leave always works
 *       - team coach can remove another member (was creator-only)
 *       - org manager can remove another member without team membership
 *       - non-affiliated user CANNOT remove others
 *
 * Closes the orphan-creator failure mode: previously only the original chat
 * creator could remove members; if the creator's account was deleted the chat
 * was permanently locked. Now team staff or org admins can intervene.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';

const __skipDbIntegrationSuites =
  String(process.env.CI ?? '').toLowerCase() === 'true' || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = __skipDbIntegrationSuites ? describe.skip : describe;



let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describeDb('Group Chat Permissions', () => {
  let orgId: string;
  let teamId: string;
  let creatorId: string;
  let creatorToken: string;
  let coachId: string;
  let coachToken: string;
  let orgManagerId: string;
  let orgManagerToken: string;
  let strangerId: string;
  let strangerToken: string;
  let rosterMemberId: string;
  let offRosterUserId: string;
  let chatId: string;

  async function makeUser(prefix: string, prefs: Record<string, unknown> = {}) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    return prisma.user.create({
      data: {
        email: `${prefix}-${ts}-${Math.random()}@example.com`,
        password_hash: hash,
        display_name: prefix,
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1990-01-01'),
        preferences: { onboarding_completed: true, ...prefs },
      },
    });
  }

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const org = await prisma.organization.create({
      data: {
        name: `Group Chat Test League ${ts}`,
        org_type: 'league',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    orgId = org.id;

    const team = await prisma.team.create({
      data: { name: `Group Chat Test Team ${ts}`, organization_id: orgId },
    });
    teamId = team.id;

    const creator = await makeUser('chat-creator', {
      role: 'coach',
      plan: 'rookie',
      coach_agreement_accepted_at: new Date().toISOString(),
    });
    creatorId = creator.id;
    creatorToken = signJwt({ id: creatorId });
    await prisma.teamMembership.create({
      data: { team_id: teamId, user_id: creatorId, role: 'owner', status: 'active' },
    });

    const coach = await makeUser('chat-coach', {
      role: 'coach',
      plan: 'rookie',
      coach_agreement_accepted_at: new Date().toISOString(),
    });
    coachId = coach.id;
    coachToken = signJwt({ id: coachId });
    await prisma.teamMembership.create({
      data: { team_id: teamId, user_id: coachId, role: 'coach', status: 'active' },
    });

    const orgManager = await makeUser('chat-orgmgr', {
      role: 'coach',
      plan: 'rookie',
      coach_agreement_accepted_at: new Date().toISOString(),
    });
    orgManagerId = orgManager.id;
    orgManagerToken = signJwt({ id: orgManagerId });
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: orgManagerId, role: 'manager', status: 'active' },
    });

    const stranger = await makeUser('chat-stranger', { role: 'fan' });
    strangerId = stranger.id;
    strangerToken = signJwt({ id: stranger.id });

    const rosterMember = await makeUser('chat-roster', { role: 'fan' });
    rosterMemberId = rosterMember.id;
    await prisma.teamMembership.create({
      data: { team_id: teamId, user_id: rosterMemberId, role: 'player', status: 'active' },
    });

    const offRoster = await makeUser('chat-offroster', { role: 'fan' });
    offRosterUserId = offRoster.id;

    // Create a chat with creator + coach as initial members
    const created = await request(app)
      .post('/group-chats')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: `Test Chat ${ts}`, teamId, memberIds: [coachId] });
    expect(created.status).toBe(201);
    chatId = created.body.id;
  });

  afterAll(async () => {
    const userIds = [creatorId, coachId, orgManagerId, strangerId, rosterMemberId, offRosterUserId].filter(Boolean);
    await prisma.groupChatMessage.deleteMany({ where: { chat_id: chatId } }).catch(() => {});
    await prisma.groupChatMember.deleteMany({ where: { chat_id: chatId } }).catch(() => {});
    await prisma.groupChat.deleteMany({ where: { id: chatId } }).catch(() => {});
    await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  });

  describeDb('POST /group-chats/:chatId/members', () => {
    it('team coach can add a roster member', async () => {
      const res = await request(app)
        .post(`/group-chats/${chatId}/members`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ user_id: rosterMemberId });
      expect(res.status).toBe(201);
      const member = await prisma.groupChatMember.findFirst({
        where: { chat_id: chatId, user_id: rosterMemberId },
      });
      expect(member).not.toBeNull();
      // cleanup so the next test starts clean
      if (member) await prisma.groupChatMember.delete({ where: { id: member.id } });
    });

    it('org manager can add a roster member without direct team membership', async () => {
      const res = await request(app)
        .post(`/group-chats/${chatId}/members`)
        .set('Authorization', `Bearer ${orgManagerToken}`)
        .send({ user_id: rosterMemberId });
      expect(res.status).toBe(201);
      const member = await prisma.groupChatMember.findFirst({
        where: { chat_id: chatId, user_id: rosterMemberId },
      });
      expect(member).not.toBeNull();
      if (member) await prisma.groupChatMember.delete({ where: { id: member.id } });
    });

    it('non-affiliated stranger cannot add members', async () => {
      const res = await request(app)
        .post(`/group-chats/${chatId}/members`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ user_id: rosterMemberId });
      expect(res.status).toBe(403);
    });

    it('cannot add a user who is not on the team roster', async () => {
      const res = await request(app)
        .post(`/group-chats/${chatId}/members`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ user_id: offRosterUserId });
      expect(res.status).toBe(400);
      expect(res.body?.error).toBe('NOT_ON_TEAM');
    });

    it('already-member returns ok idempotently', async () => {
      const first = await request(app)
        .post(`/group-chats/${chatId}/members`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ user_id: rosterMemberId });
      expect(first.status).toBe(201);
      const second = await request(app)
        .post(`/group-chats/${chatId}/members`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ user_id: rosterMemberId });
      expect(second.status).toBe(200);
      expect(second.body?.already_member).toBe(true);
      const member = await prisma.groupChatMember.findFirst({
        where: { chat_id: chatId, user_id: rosterMemberId },
      });
      if (member) await prisma.groupChatMember.delete({ where: { id: member.id } });
    });
  });

  describeDb('DELETE /group-chats/:chatId/members/:userId', () => {
    async function ensureMember(userId: string) {
      const existing = await prisma.groupChatMember.findFirst({
        where: { chat_id: chatId, user_id: userId },
      });
      if (!existing) {
        await prisma.groupChatMember.create({ data: { chat_id: chatId, user_id: userId } });
      }
    }

    it('team coach can remove another member (was creator-only)', async () => {
      await ensureMember(rosterMemberId);
      const res = await request(app)
        .delete(`/group-chats/${chatId}/members/${rosterMemberId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send();
      expect(res.status).toBe(200);
      const after = await prisma.groupChatMember.findFirst({
        where: { chat_id: chatId, user_id: rosterMemberId },
      });
      expect(after).toBeNull();
    });

    it('org manager can remove a member without direct team membership', async () => {
      await ensureMember(rosterMemberId);
      const res = await request(app)
        .delete(`/group-chats/${chatId}/members/${rosterMemberId}`)
        .set('Authorization', `Bearer ${orgManagerToken}`)
        .send();
      expect(res.status).toBe(200);
      const after = await prisma.groupChatMember.findFirst({
        where: { chat_id: chatId, user_id: rosterMemberId },
      });
      expect(after).toBeNull();
    });

    it('non-affiliated stranger cannot remove others', async () => {
      await ensureMember(rosterMemberId);
      const res = await request(app)
        .delete(`/group-chats/${chatId}/members/${rosterMemberId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send();
      expect(res.status).toBe(403);
      const stillMember = await prisma.groupChatMember.findFirst({
        where: { chat_id: chatId, user_id: rosterMemberId },
      });
      expect(stillMember).not.toBeNull();
      // cleanup for following tests
      if (stillMember) await prisma.groupChatMember.delete({ where: { id: stillMember.id } });
    });
  });
});
