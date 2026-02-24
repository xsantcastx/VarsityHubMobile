/**
 * API Integration Tests for Uploads Endpoints
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

describeDb('Uploads API Endpoints', () => {
  let testUser: any;
  let testUserToken: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    testUser = await prisma.user.create({
      data: {
        email: `test-uploads-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Upload Tester',
        email_verified: true,
        preferences: { role: 'fan' },
      },
    });
    testUserToken = signJwt({ id: testUser.id });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: testUser.id } }).catch(() => {});
  });

  describe('POST /uploads', () => {
    it('should require authentication', async () => {
      const res = await request(app).post('/uploads');
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('POST /uploads/files', () => {
    it('should require authentication', async () => {
      const res = await request(app).post('/uploads/files');
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /uploads/sign', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/uploads/sign?path=/uploads/test.png');
      expect(res.statusCode).toEqual(401);
    });

    it('should return signed URL for authenticated users', async () => {
      const res = await request(app)
        .get('/uploads/sign?path=/uploads/test.png')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.exp).toBeDefined();
      expect(res.body.signed_url).toContain('/uploads/test.png');
    });

    it('should reject invalid paths', async () => {
      const res = await request(app)
        .get('/uploads/sign?path=../secrets.txt')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(400);
    });
  });
});
