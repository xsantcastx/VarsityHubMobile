/**
 * GET /group-chats — unreadCount must reflect true unread (pass 11 regression guard).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';
import { describeDb } from './dbTestGuard.js';
let prisma: any;
let signJwt: any;

const TEST_A_EMAIL = `test-gc-a-${Date.now()}@example.com`;
const TEST_B_EMAIL = `test-gc-b-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

describeDb('API Group chats', () => {
  let userAId: string;
  let userBId: string;
  let tokenA: string;
  let chatId: string;
  let orgId: string;
  let teamId: string;
  let orgManagerId: string;
  let orgManagerToken: string;
  let rosterMemberId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const userA = await prisma.user.create({
      data: {
        email: TEST_A_EMAIL,
        password_hash: hash,
        display_name: 'GC User A',
        email_verified: true,
        preferences: { onboarding_completed: true },
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: TEST_B_EMAIL,
        password_hash: hash,
        display_name: 'GC User B',
        email_verified: true,
        preferences: { onboarding_completed: true },
      },
    });
    userAId = userA.id;
    userBId = userB.id;
    tokenA = signJwt({ id: userAId });

    const orgManager = await prisma.user.create({
      data: {
        email: `test-gc-org-manager-${Date.now()}@example.com`,
        password_hash: hash,
        display_name: 'GC Org Manager',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    orgManagerId = orgManager.id;
    orgManagerToken = signJwt({ id: orgManagerId });

    const rosterMember = await prisma.user.create({
      data: {
        email: `test-gc-roster-member-${Date.now()}@example.com`,
        password_hash: hash,
        display_name: 'GC Roster Member',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    rosterMemberId = rosterMember.id;

    const org = await prisma.organization.create({
      data: {
        name: `GC Org ${Date.now()}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    orgId = org.id;

    const team = await prisma.team.create({
      data: {
        name: `GC Team ${Date.now()}`,
        organization_id: org.id,
      },
    });
    teamId = team.id;

    await prisma.organizationMembership.create({
      data: {
        organization_id: org.id,
        user_id: orgManagerId,
        role: 'manager',
        status: 'active',
      },
    });
    await prisma.teamMembership.create({
      data: {
        team_id: team.id,
        user_id: rosterMemberId,
        role: 'member',
        status: 'active',
      },
    });

    const chat = await prisma.groupChat.create({
      data: { name: `Test GC ${Date.now()}` },
    });
    chatId = chat.id;

    // joined_at MUST predate the message timeline below — the unread count
    // query enforces a `msg.created_at >= m.joined_at` floor so pre-join
    // history doesn't appear as unread (matches what the message-fetch path
    // returns to the client).
    const memberJoinedAt = new Date('2024-05-01T00:00:00.000Z');
    await prisma.groupChatMember.createMany({
      data: [
        { chat_id: chatId, user_id: userAId, last_read_at: null, joined_at: memberJoinedAt },
        { chat_id: chatId, user_id: userBId, last_read_at: null, joined_at: memberJoinedAt },
      ],
    });

    const t0 = new Date('2024-06-01T12:00:00.000Z');
    const t1 = new Date('2024-06-02T12:00:00.000Z');
    const t2 = new Date('2024-06-03T12:00:00.000Z');

    await prisma.groupChatMessage.createMany({
      data: [
        { chat_id: chatId, sender_id: userBId, content: 'm1', created_at: t0 },
        { chat_id: chatId, sender_id: userBId, content: 'm2', created_at: t1 },
        { chat_id: chatId, sender_id: userBId, content: 'm3', created_at: t2 },
      ],
    });
  });

  afterAll(async () => {
    try {
      if (chatId) {
        await prisma.groupChatMessage.deleteMany({ where: { chat_id: chatId } });
        await prisma.groupChatMember.deleteMany({ where: { chat_id: chatId } });
        await prisma.groupChat.delete({ where: { id: chatId } }).catch(() => {});
      }
      await prisma.groupChat.deleteMany({ where: { team_id: teamId } }).catch(() => {});
      await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
      await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
      await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: [userAId, userBId, orgManagerId, rosterMemberId] } },
      });
    } catch (e) {
      console.warn('group-chats test cleanup:', e);
    }
  });

  it('GET /group-chats returns unreadCount equal to messages from others when never read', async () => {
    const res = await request(app)
      .get('/group-chats')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const body = res.body as any[];
    expect(Array.isArray(body)).toBe(true);
    const row = body.find((c) => c.id === chatId);
    expect(row).toBeTruthy();
    expect(row.unreadCount).toBe(3);
    expect(row.lastMessage).toBeTruthy();
    expect(row.lastMessage.content).toBe('m3');
  });

  it('GET /group-chats respects last_read_at for unread from others', async () => {
    const boundary = new Date('2024-06-02T18:00:00.000Z');
    await prisma.groupChatMember.updateMany({
      where: { chat_id: chatId, user_id: userAId },
      data: { last_read_at: boundary },
    });

    const res = await request(app)
      .get('/group-chats')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const body = res.body as any[];
    const row = body.find((c) => c.id === chatId);
    expect(row?.unreadCount).toBe(1);

    await prisma.groupChatMessage.create({
      data: {
        chat_id: chatId,
        sender_id: userAId,
        content: 'from self',
        created_at: new Date('2024-06-04T12:00:00.000Z'),
      },
    });

    const res2 = await request(app)
      .get('/group-chats')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const row2 = (res2.body as any[]).find((c) => c.id === chatId);
    expect(row2?.unreadCount).toBe(1);
  });

  it('GET /group-chats applies joined_at floor — pre-join history is NOT counted unread', async () => {
    // Regression: previously the unread-count query only filtered by
    // last_read_at, NOT joined_at. A new member added after a chat already
    // had history would see unread badges for messages they cannot
    // actually fetch (the message-fetch path does enforce joined_at).
    // This test pins the contract: unread count must mirror what's
    // visible in the message list.
    await prisma.groupChatMember.updateMany({
      where: { chat_id: chatId, user_id: userAId },
      data: {
        last_read_at: null,
        joined_at: new Date('2024-12-01T00:00:00.000Z'),
      },
    });

    const res = await request(app)
      .get('/group-chats')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const row = (res.body as any[]).find((c) => c.id === chatId);
    // The 3 fixture messages from beforeAll (2024-06-01..03) all predate
    // the simulated join (2024-12-01), so unread MUST be 0.
    expect(row?.unreadCount).toBe(0);
  });

  it('GET /group-chats returns exact unread counts beyond 1000 messages', async () => {
    await prisma.groupChatMessage.deleteMany({ where: { chat_id: chatId } });
    await prisma.groupChatMember.updateMany({
      where: { chat_id: chatId, user_id: userAId },
      data: {
        last_read_at: null,
        // Reset joined_at to predate the bulk messages — the prior test
        // pushed it forward to 2024-12-01 to verify the floor, which would
        // exclude every message here if not reset.
        joined_at: new Date('2024-05-01T00:00:00.000Z'),
      },
    });

    const bulk = Array.from({ length: 1005 }, (_, index) => ({
      chat_id: chatId,
      sender_id: userBId,
      content: `bulk-${index + 1}`,
      created_at: new Date(`2024-07-01T00:${String(index % 60).padStart(2, '0')}:00.000Z`),
    }));
    await prisma.groupChatMessage.createMany({ data: bulk });

    const res = await request(app)
      .get('/group-chats')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const row = (res.body as any[]).find((c) => c.id === chatId);
    expect(row?.unreadCount).toBe(1005);
  });

  it('allows an org manager to create a team chat without direct team membership', async () => {
    const res = await request(app)
      .post('/group-chats')
      .set('Authorization', `Bearer ${orgManagerToken}`)
      .send({
        name: 'Org Manager Team Chat',
        teamId,
        memberIds: [rosterMemberId],
      })
      .expect(201);

    expect(res.body.team_id).toBe(teamId);
    expect(res.body.created_by).toBe(orgManagerId);
    expect(Array.isArray(res.body.members)).toBe(true);
    expect(res.body.members.map((m: any) => m.user_id).sort()).toEqual(
      [orgManagerId, rosterMemberId].sort()
    );
  });
});
