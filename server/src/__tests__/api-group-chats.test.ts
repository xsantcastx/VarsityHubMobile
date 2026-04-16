/**
 * GET /group-chats — unreadCount must reflect true unread (pass 11 regression guard).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

const TEST_A_EMAIL = `test-gc-a-${Date.now()}@example.com`;
const TEST_B_EMAIL = `test-gc-b-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

describe('API Group chats', () => {
  let userAId: string;
  let userBId: string;
  let tokenA: string;
  let chatId: string;

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

    const chat = await prisma.groupChat.create({
      data: { name: `Test GC ${Date.now()}` },
    });
    chatId = chat.id;

    await prisma.groupChatMember.createMany({
      data: [
        { chat_id: chatId, user_id: userAId, last_read_at: null },
        { chat_id: chatId, user_id: userBId, last_read_at: null },
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
      await prisma.user.deleteMany({
        where: { id: { in: [userAId, userBId] } },
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
});
