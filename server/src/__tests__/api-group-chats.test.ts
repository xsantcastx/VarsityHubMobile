import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const RUN_ID = Date.now();
const TEST_PASSWORD = 'TestPassword123!';
const CURRENT_USER_EMAIL = `group-chat-user-${RUN_ID}@example.com`;
const OTHER_USER_EMAIL = `group-chat-other-${RUN_ID}@example.com`;

describe('API Group Chat Endpoints', () => {
  let currentUserId: string;
  let currentUserToken: string;
  let otherUserId: string;
  let chatId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const [currentUser, otherUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: CURRENT_USER_EMAIL,
          password_hash: passwordHash,
          display_name: 'Current Group User',
          email_verified: true,
          preferences: { role: 'fan' },
        },
      }),
      prisma.user.create({
        data: {
          email: OTHER_USER_EMAIL,
          password_hash: passwordHash,
          display_name: 'Other Group User',
          email_verified: true,
          preferences: { role: 'fan' },
        },
      }),
    ]);

    currentUserId = currentUser.id;
    currentUserToken = signJwt({ id: currentUserId });
    otherUserId = otherUser.id;

    const chat = await prisma.groupChat.create({
      data: {
        name: `Unread Count Chat ${RUN_ID}`,
        created_by: currentUserId,
      },
    });
    chatId = chat.id;

    const lastReadAt = new Date(Date.now() - 60_000);

    await prisma.groupChatMember.createMany({
      data: [
        {
          chat_id: chatId,
          user_id: currentUserId,
          last_read_at: lastReadAt,
        },
        {
          chat_id: chatId,
          user_id: otherUserId,
        },
      ],
    });

    await prisma.groupChatMessage.createMany({
      data: [
        {
          chat_id: chatId,
          sender_id: otherUserId,
          content: 'Old message',
          created_at: new Date(lastReadAt.getTime() - 30_000),
        },
        {
          chat_id: chatId,
          sender_id: currentUserId,
          content: 'My own message',
          created_at: new Date(lastReadAt.getTime() + 5_000),
        },
        {
          chat_id: chatId,
          sender_id: otherUserId,
          content: 'Unread one',
          created_at: new Date(lastReadAt.getTime() + 10_000),
        },
        {
          chat_id: chatId,
          sender_id: otherUserId,
          content: 'Unread two',
          created_at: new Date(lastReadAt.getTime() + 20_000),
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      await prisma.groupChatMessage.deleteMany({ where: { chat_id: chatId } });
      await prisma.groupChatMember.deleteMany({ where: { chat_id: chatId } });
      await prisma.groupChat.deleteMany({ where: { id: chatId } });
      await prisma.user.deleteMany({
        where: { id: { in: [currentUserId, otherUserId] } },
      });
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  it('returns the exact unread count based on last_read_at', async () => {
    const response = await request(app)
      .get('/group-chats')
      .set('Authorization', `Bearer ${currentUserToken}`)
      .expect(200);

    const chat = response.body.find((item: any) => item.id === chatId);
    expect(chat).toBeTruthy();
    expect(chat.unreadCount).toBe(2);
    expect(chat.memberCount).toBe(2);
  });

  it('drops unread count to zero after marking the chat as read', async () => {
    await request(app)
      .post(`/group-chats/${chatId}/read`)
      .set('Authorization', `Bearer ${currentUserToken}`)
      .expect(200);

    const response = await request(app)
      .get('/group-chats')
      .set('Authorization', `Bearer ${currentUserToken}`)
      .expect(200);

    const chat = response.body.find((item: any) => item.id === chatId);
    expect(chat).toBeTruthy();
    expect(chat.unreadCount).toBe(0);
  });
});
