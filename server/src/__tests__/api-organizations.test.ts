/**
 * API Integration Tests - Organization Endpoints
 *
 * Locks the coach-only enforcement on POST /organizations and
 * POST /organizations/create. Founder rule: fan accounts must never
 * be able to create organizations.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

const RUN_ID = Date.now();
const TEST_COACH_EMAIL = `test-api-org-coach-${RUN_ID}@example.com`;
const TEST_FAN_EMAIL = `test-api-org-fan-${RUN_ID}@example.com`;
const TEST_UNVERIFIED_EMAIL = `test-api-org-unverified-${RUN_ID}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

describe('API Organization Endpoints — coach role enforcement', () => {
  let coachUserId: string;
  let coachToken: string;
  let fanUserId: string;
  let fanToken: string;
  let unverifiedUserId: string;
  let unverifiedToken: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const coachPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const coach = await prisma.user.create({
      data: {
        email: TEST_COACH_EMAIL,
        password_hash: coachPasswordHash,
        display_name: 'Test Org Coach',
        email_verified: true,
        preferences: { role: 'coach' },
      },
    });
    coachUserId = coach.id;
    coachToken = signJwt({ id: coachUserId });

    const fanPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const fan = await prisma.user.create({
      data: {
        email: TEST_FAN_EMAIL,
        password_hash: fanPasswordHash,
        display_name: 'Test Org Fan',
        email_verified: true,
        preferences: { role: 'fan' },
      },
    });
    fanUserId = fan.id;
    fanToken = signJwt({ id: fanUserId });

    // Unverified coach — must be blocked even though their role would allow it.
    const unverifiedHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const unverified = await prisma.user.create({
      data: {
        email: TEST_UNVERIFIED_EMAIL,
        password_hash: unverifiedHash,
        display_name: 'Test Unverified Coach',
        email_verified: false,
        preferences: { role: 'coach' },
      },
    });
    unverifiedUserId = unverified.id;
    unverifiedToken = signJwt({ id: unverifiedUserId });
  });

  afterAll(async () => {
    try {
      if (createdOrgIds.length) {
        await prisma.organizationMembership.deleteMany({
          where: { organization_id: { in: createdOrgIds } },
        });
        await prisma.organization.deleteMany({
          where: { id: { in: createdOrgIds } },
        });
      }
      await prisma.user.deleteMany({
        where: { id: { in: [coachUserId, fanUserId, unverifiedUserId] } },
      });
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  describe('POST /organizations', () => {
    it('rejects fan accounts with 403 COACH_ROLE_REQUIRED', async () => {
      const response = await request(app)
        .post('/organizations')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          name: `Fan Org ${RUN_ID}`,
          description: 'Should be blocked',
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('COACH_ROLE_REQUIRED');
    });

    it('requires authentication', async () => {
      await request(app)
        .post('/organizations')
        .send({ name: 'Anonymous Org' })
        .expect(401);
    });

    it('rejects unverified coach with 403 (email verification required)', async () => {
      const response = await request(app)
        .post('/organizations')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send({
          name: `Unverified Coach Org ${RUN_ID}`,
          description: 'Should be blocked by requireVerified',
        })
        .expect(403);

      expect(response.body?.error).toMatch(/verification/i);
    });

    it('allows coach accounts to create an organization', async () => {
      const response = await request(app)
        .post('/organizations')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: `Coach Org ${RUN_ID}`,
          description: 'Coach-owned org',
          zip_code: `${RUN_ID}`.slice(-5),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(`Coach Org ${RUN_ID}`);
      createdOrgIds.push(response.body.id);
    });
  });

  describe('POST /organizations/create', () => {
    it('rejects fan accounts with 403 COACH_ROLE_REQUIRED', async () => {
      const response = await request(app)
        .post('/organizations/create')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          name: `Fan Org Create ${RUN_ID}`,
          description: 'Should be blocked',
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('COACH_ROLE_REQUIRED');
    });

    it('requires authentication', async () => {
      await request(app)
        .post('/organizations/create')
        .send({ name: 'Anonymous Org' })
        .expect(401);
    });

    it('rejects unverified coach with 403 (email verification required)', async () => {
      const response = await request(app)
        .post('/organizations/create')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send({
          name: `Unverified Coach Org Create ${RUN_ID}`,
          description: 'Should be blocked by requireVerified',
        })
        .expect(403);

      expect(response.body?.error).toMatch(/verification/i);
    });
  });
});
