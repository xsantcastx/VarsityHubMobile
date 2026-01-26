/**
 * API Integration Tests for Users Endpoints
 * 
 * Tests the users API endpoints with real HTTP requests
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

describeDb('Users API Endpoints', () => {
  let testUser: any;
  let testUserToken: string;
  let otherUser: any;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: `test-users-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Test User',
        email_verified: true,
        preferences: { role: 'fan' },
      },
    });
    testUserToken = signJwt({ id: testUser.id });

    // Create another user for follow tests
    otherUser = await prisma.user.create({
      data: {
        email: `test-users-other-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Other User',
        email_verified: true,
        preferences: { role: 'fan' },
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        id: { in: [testUser.id, otherUser.id] },
      },
    }).catch(() => {});
  });

  describe('GET /users/:id', () => {
    it('should return user by id', async () => {
      const res = await request(app)
        .get(`/users/${testUser.id}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.id).toBe(testUser.id);
      expect(res.body.display_name).toBe(testUser.display_name);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/users/non-existent-id');

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /users/:id/posts', () => {
    it('should return user posts', async () => {
      // Create a test post first
      const post = await prisma.post.create({
        data: {
          author_id: testUser.id,
          title: 'Test Post',
          content: 'Test content',
        },
      });

      const res = await request(app)
        .get(`/users/${testUser.id}/posts`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.items)).toBe(true);

      // Clean up
      await prisma.post.delete({ where: { id: post.id } }).catch(() => {});
    });
  });

  describe('GET /users/:id/followers', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get(`/users/${testUser.id}/followers`);

      expect(res.statusCode).toEqual(401);
    });

    it('should return user followers for authenticated users', async () => {
      const res = await request(app)
        .get(`/users/${testUser.id}/followers`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      if (res.body.items.length > 0) {
        const follower = res.body.items[0];
        expect(follower.email).toBeUndefined();
        expect(follower.password_hash).toBeUndefined();
      }
    });
  });

  describe('GET /users/:id/following', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get(`/users/${testUser.id}/following`);

      expect(res.statusCode).toEqual(401);
    });

    it('should return users this user follows for authenticated users', async () => {
      const res = await request(app)
        .get(`/users/${testUser.id}/following`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      if (res.body.items.length > 0) {
        const following = res.body.items[0];
        expect(following.email).toBeUndefined();
        expect(following.password_hash).toBeUndefined();
      }
    });
  });

  describe('GET /users/search/mentions', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/users/search/mentions?q=other');
      expect(res.statusCode).toEqual(401);
    });

    it('should not expose email in mentions results', async () => {
      const res = await request(app)
        .get('/users/search/mentions?q=other')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.statusCode).toEqual(200);
      const users = Array.isArray(res.body) ? res.body : res.body.users;
      expect(Array.isArray(users)).toBe(true);
      if (users.length > 0) {
        expect(users[0].email).toBeUndefined();
      }
    });
  });
});
