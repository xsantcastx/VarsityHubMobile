/**
 * API Integration Tests for Users Endpoints
 * 
 * Tests the users API endpoints with real HTTP requests
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import { signJwt } from '../lib/jwt.js';
import bcrypt from 'bcrypt';

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

describeDb('Users API Endpoints', () => {
  let testUser: any;
  let testUserToken: string;
  let otherUser: any;

  beforeAll(async () => {
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
      expect(res.body.email).toBe(testUser.email);
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
      expect(Array.isArray(res.body)).toBe(true);

      // Clean up
      await prisma.post.delete({ where: { id: post.id } }).catch(() => {});
    });
  });

  describe('GET /users/:id/followers', () => {
    it('should return user followers', async () => {
      const res = await request(app)
        .get(`/users/${testUser.id}/followers`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/following', () => {
    it('should return users that this user follows', async () => {
      const res = await request(app)
        .get(`/users/${testUser.id}/following`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
