/**
 * API Integration Tests - Event Endpoints
 * 
 * Tests actual HTTP endpoints for event management:
 * - POST /events (create event with approval workflow)
 * - GET /events (list events)
 * - Coach auto-approval vs fan approval requirement
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import { signJwt } from '../lib/jwt.js';

const TEST_COACH_EMAIL = `test-api-event-coach-${Date.now()}@example.com`;
const TEST_FAN_EMAIL = `test-api-event-fan-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

describe('API Event Endpoints', () => {
  let coachUserId: string;
  let coachToken: string;
  let fanUserId: string;
  let fanToken: string;

  beforeAll(async () => {
    // Create coach user
    const coachPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const coach = await prisma.user.create({
      data: {
        email: TEST_COACH_EMAIL,
        password_hash: coachPasswordHash,
        display_name: 'Test Coach',
        email_verified: true,
        preferences: {
          role: 'coach',
        },
      },
    });
    coachUserId = coach.id;
    coachToken = signJwt({ id: coachUserId });

    // Create fan user
    const fanPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const fan = await prisma.user.create({
      data: {
        email: TEST_FAN_EMAIL,
        password_hash: fanPasswordHash,
        display_name: 'Test Fan',
        email_verified: true,
        preferences: {
          role: 'fan',
        },
      },
    });
    fanUserId = fan.id;
    fanToken = signJwt({ id: fanUserId });
  });

  afterAll(async () => {
    try {
      // Clean up events
      await prisma.event.deleteMany({
        where: {
          creator_id: {
            in: [coachUserId, fanUserId],
          },
        },
      });

      // Clean up users
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [coachUserId, fanUserId],
          },
        },
      });
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  describe('POST /events', () => {
    it('should auto-approve events created by coaches', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          title: 'Coach Event',
          date: futureDate.toISOString(),
          location: 'Test Stadium',
          event_type: 'game',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('approved');
      expect(response.body.approval_status).toBe('approved');
      expect(response.body.creator_id).toBe(coachUserId);
    });

    it('should require approval for events created by fans', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          title: 'Fan Event',
          date: futureDate.toISOString(),
          location: 'Test Location',
          event_type: 'fundraiser',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('pending');
      expect(response.body.approval_status).toBe('pending');
      expect(response.body.creator_id).toBe(fanUserId);
    });

    it('should require authentication', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/events')
        .send({
          title: 'Unauthorized Event',
          date: futureDate.toISOString(),
          location: 'Test',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should require event title', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          date: futureDate.toISOString(),
          location: 'Test',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should require event date', async () => {
      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          title: 'Event Without Date',
          location: 'Test',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should sanitize event title (trim whitespace)', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          title: '  Trimmed Event  ',
          date: futureDate.toISOString(),
          location: 'Test',
        })
        .expect(201);

      expect(response.body.title).toBe('Trimmed Event');
      expect(response.body.title).not.toContain('  ');
    });

    it('should sanitize event location (trim whitespace)', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          title: 'Test Event',
          date: futureDate.toISOString(),
          location: '  Trimmed Location  ',
        })
        .expect(201);

      expect(response.body.location).toBe('Trimmed Location');
      expect(response.body.location).not.toContain('  ');
    });
  });

  describe('GET /events', () => {
    it('should return list of approved events', async () => {
      const response = await request(app)
        .get('/events')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter events by status', async () => {
      const response = await request(app)
        .get('/events?status=approved')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter events by approval_status', async () => {
      const response = await request(app)
        .get('/events?approval_status=pending')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should search events by query', async () => {
      const response = await request(app)
        .get('/events?q=Test')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should limit number of results', async () => {
      const response = await request(app)
        .get('/events?limit=10')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10);
    });
  });
});
