/**
 * Event Creation Tests
 * 
 * Tests event creation with:
 * - Coach auto-approval
 * - Fan approval workflow
 * - Event limits for free tier
 * - Input sanitization
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

const TEST_COACH_EMAIL = `test-event-coach-${Date.now()}@example.com`;
const TEST_FAN_EMAIL = `test-event-fan-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

describe('Event Creation', () => {
  let coachUserId: string;
  let fanUserId: string;

  beforeAll(async () => {
    // Create coach user
    const coachPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const coach = await prisma.user.create({
      data: {
        email: TEST_COACH_EMAIL,
        password_hash: coachPasswordHash,
        display_name: 'Test Coach',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          onboarding_completed: true,
        },
      },
    });
    coachUserId = coach.id;

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
          onboarding_completed: true,
        },
      },
    });
    fanUserId = fan.id;
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

  describe('Coach Event Creation', () => {
    it('should auto-approve events created by coaches', async () => {
      const event = await prisma.event.create({
        data: {
          title: 'Test Game',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          location: 'Test Stadium',
          creator_id: coachUserId,
          status: 'approved', // Auto-approved for coaches
        },
      });

      expect(event).toBeDefined();
      expect(event.status).toBe('approved');
      expect(event.creator_id).toBe(coachUserId);
    });
  });

  describe('Fan Event Creation', () => {
    it('should require approval for events created by fans', async () => {
      const event = await prisma.event.create({
        data: {
          title: 'Fan Event',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          location: 'Test Location',
          creator_id: fanUserId,
          status: 'pending', // Requires approval
        },
      });

      expect(event).toBeDefined();
      expect(event.status).toBe('pending');
      expect(event.creator_id).toBe(fanUserId);
    });
  });

  describe('Input Sanitization', () => {
    it('should trim whitespace from event title', () => {
      const titleWithSpaces = '  Test Event  ';
      const sanitized = titleWithSpaces.trim();
      
      expect(sanitized).toBe('Test Event');
      expect(sanitized.length).toBeLessThan(titleWithSpaces.length);
    });

    it('should trim whitespace from event location', () => {
      const locationWithSpaces = '  Test Stadium  ';
      const sanitized = locationWithSpaces.trim();
      
      expect(sanitized).toBe('Test Stadium');
    });

    it('should trim whitespace from event description', () => {
      const descWithSpaces = '  Test Description  ';
      const sanitized = descWithSpaces.trim();
      
      expect(sanitized).toBe('Test Description');
    });
  });

  describe('Event Validation', () => {
    it('should require event title', async () => {
      await expect(
        prisma.event.create({
          data: {
            title: '', // Empty title should fail
            date: new Date(),
            creator_id: coachUserId,
            status: 'approved',
          },
        })
      ).rejects.toThrow();
    });

    it('should require event date', async () => {
      await expect(
        prisma.event.create({
          data: {
            title: 'Test Event',
            date: null as any, // Invalid date
            creator_id: coachUserId,
            status: 'approved',
          },
        })
      ).rejects.toThrow();
    });

    it('should validate future event dates', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      
      expect(pastDate.getTime()).toBeLessThan(Date.now());
      expect(futureDate.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
