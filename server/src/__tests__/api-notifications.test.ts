import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

describe('API Notification Endpoints', () => {
  let userId: string;
  let token: string;
  let createdNotificationIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const user = await prisma.user.create({
      data: {
        email: `notif-user-${Date.now()}@example.com`,
        password_hash: passwordHash,
        display_name: 'Notification User',
        email_verified: true,
        onboarding_completed: true,
      },
      select: { id: true },
    });
    userId = user.id;
    token = signJwt({ id: userId });
  });

  afterAll(async () => {
    if (createdNotificationIds.length > 0) {
      await prisma.notification
        .deleteMany({ where: { id: { in: createdNotificationIds } } })
        .catch(() => {});
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('uses a stable cursor that paginates by created_at and id together', async () => {
    const base = Date.now();
    const rows = [];
    for (let i = 0; i < 3; i += 1) {
      const notification = await prisma.notification.create({
        data: {
          user_id: userId,
          type: 'FOLLOW',
          meta: { order: i },
          created_at: new Date(base - i * 1000),
        },
        select: { id: true },
      });
      rows.push(notification);
      createdNotificationIds.push(notification.id);
    }

    const firstPage = await request(app)
      .get('/notifications?limit=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(firstPage.body.items).toHaveLength(2);
    expect(typeof firstPage.body.nextCursor).toBe('string');
    expect(firstPage.body.items.map((item: any) => item.id)).toEqual(
      expect.arrayContaining([rows[0].id, rows[1].id])
    );

    const secondPage = await request(app)
      .get(`/notifications?limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0]?.id).toBe(rows[2].id);
    expect(secondPage.body.nextCursor).toBeNull();
  });

  it('rejects an invalid cursor instead of silently returning the wrong page', async () => {
    const response = await request(app)
      .get('/notifications?cursor=bad-cursor')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(response.body.error).toBe('INVALID_CURSOR');
  });

  it('reports push diagnostics without exposing the full token', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: {} },
    });

    const empty = await request(app)
      .get('/notifications/push-diagnostics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(empty.body).toMatchObject({
      push_token: { present: false, valid_format: false, preview: null },
      preferences: {
        notifications_enabled: true,
        notifications: {
          game_event_reminders: false,
          team_updates: false,
          comments_upvotes: false,
          follows_notifications: true,
          messages_notifications: true,
        },
      },
      delivery_ready: false,
    });

    const pushToken = 'ExponentPushToken[diagnostic-user-token]';
    await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          push_token: pushToken,
          notifications_enabled: true,
          notifications: {
            game_event_reminders: true,
            team_updates: false,
            comments_upvotes: true,
            follows_notifications: false,
            messages_notifications: true,
          },
        },
      },
    });

    const ready = await request(app)
      .get('/notifications/push-diagnostics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(ready.body.push_token).toEqual({
      present: true,
      valid_format: true,
      preview: 'ExponentPushTo...token]',
    });
    expect(ready.body.preferences.notifications).toMatchObject({
      game_event_reminders: true,
      team_updates: false,
      comments_upvotes: true,
      follows_notifications: false,
      messages_notifications: true,
    });
    expect(ready.body.delivery_ready).toBe(true);
    expect(JSON.stringify(ready.body)).not.toContain(pushToken);
  });
});
