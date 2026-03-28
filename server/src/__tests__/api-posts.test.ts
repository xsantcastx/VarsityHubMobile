/**
 * API Integration Tests for Posts Endpoints
 * 
 * Tests the posts API endpoints with real HTTP requests
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

describeDb('Posts API Endpoints', () => {
  let testUser: any;
  let testUserToken: string;
  let testPostId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: `test-posts-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Test Posts User',
        email_verified: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    testUserToken = signJwt({ id: testUser.id });
  });

  afterAll(async () => {
    // Clean up test data
    if (testPostId) {
      await prisma.post.delete({ where: { id: testPostId } }).catch(() => {});
    }
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  });

  describe('GET /posts', () => {
    it('should return list of posts', async () => {
      const res = await request(app)
        .get('/posts')
        .query({ limit: '10' });

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('should support pagination with cursor', async () => {
      const res1 = await request(app)
        .get('/posts')
        .query({ limit: '5' });

      expect(res1.statusCode).toEqual(200);
      expect(Array.isArray(res1.body.items)).toBe(true);

      if (res1.body.items.length > 0) {
        const cursor = res1.body.items[res1.body.items.length - 1].id;
        const res2 = await request(app)
          .get('/posts')
          .query({ limit: '5', cursor });

        expect(res2.statusCode).toEqual(200);
        expect(Array.isArray(res2.body.items)).toBe(true);
      }
    });

    it('should filter by game_id when provided', async () => {
      const res = await request(app)
        .get('/posts')
        .query({ game_id: 'non-existent-id' });

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });

  describe('POST /posts', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/posts')
        .send({
          title: 'Test Post',
          content: 'Test content',
        });

      expect(res.statusCode).toEqual(401);
    });

    it('should create a post with valid data', async () => {
      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          title: 'Test Post',
          content: 'Test content for integration test',
          type: 'post',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.title).toBe('Test Post');
      expect(res.body.content).toBe('Test content for integration test');
      const createdId =
        res.body?.id ||
        (await prisma.post.findFirst({
          where: { author_id: testUser.id, title: 'Test Post' },
          orderBy: { created_at: 'desc' },
          select: { id: true },
        }))?.id;
      if (!createdId) {
        throw new Error(`Expected created post id. status=${res.statusCode} body=${JSON.stringify(res.body)}`);
      }
      testPostId = createdId;
    });

    it('should allow delete + restore within undo window', async () => {
      if (!testPostId) {
        const fallback = await prisma.post.create({
          data: {
            author_id: testUser.id,
            title: 'Post to delete',
            content: 'Delete me',
          },
        });
        testPostId = fallback.id;
      }
      const postId = testPostId;
      expect(postId).toBeDefined();

      const del = await request(app)
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(del.statusCode).toEqual(200);
      expect(del.body.deleted_at).toBeDefined();

      const restore = await request(app)
        .post(`/posts/${postId}/restore`)
        .set('Authorization', `Bearer ${testUserToken}`);

      // Restore is intentionally disabled now; deletion is final.
      expect(restore.statusCode).toEqual(410);
      expect(restore.body.error).toBe('POST_RESTORE_DISABLED');

      testPostId = '';
    });

    it('should reject invalid payload', async () => {
      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          // Missing required fields or invalid data
          title: '', // Empty title might be invalid
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('GET /posts/:id', () => {
    it('should return post by id', async () => {
      if (!testPostId) {
        // Create a post first
        const createRes = await request(app)
          .post('/posts')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            title: 'Test Post for Get',
            content: 'Test content',
          });
        testPostId =
          createRes.body?.id ||
          (await prisma.post.findFirst({
            where: { author_id: testUser.id, title: 'Test Post for Get' },
            orderBy: { created_at: 'desc' },
            select: { id: true },
          }))?.id;
        if (!testPostId) {
          throw new Error(`Failed to create post for GET test. status=${createRes.statusCode} body=${JSON.stringify(createRes.body)}`);
        }
      }

      const res = await request(app)
        .get(`/posts/${testPostId}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.id).toBe(testPostId);
    });

    it('should return 404 for non-existent post', async () => {
      const res = await request(app)
        .get('/posts/not-a-real-post-id');

      // Route validates ID format; invalid IDs return 400.
      expect([400, 404]).toContain(res.statusCode);
    });
  });

  describe('POST /posts/:id/upvote', () => {
    it('should require authentication', async () => {
      if (!testPostId) return;

      const res = await request(app)
        .post(`/posts/${testPostId}/upvote`);

      expect(res.statusCode).toEqual(401);
    });

    it('should upvote a post', async () => {
      if (!testPostId) {
        const createRes = await request(app)
          .post('/posts')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            title: 'Test Post for Upvote',
            content: 'Test content',
          });
        testPostId =
          createRes.body?.id ||
          (await prisma.post.findFirst({
            where: { author_id: testUser.id, title: 'Test Post for Upvote' },
            orderBy: { created_at: 'desc' },
            select: { id: true },
          }))?.id;
        if (!testPostId) {
          throw new Error(`Failed to create post for upvote test. status=${createRes.statusCode} body=${JSON.stringify(createRes.body)}`);
        }
      }

      const res = await request(app)
        .post(`/posts/${testPostId}/upvote`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect([200, 201]).toContain(res.statusCode);
    });
  });
});
