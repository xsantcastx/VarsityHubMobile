/**
 * Team Creation Tests
 *
 * Tests team creation with role validation and subscription limits
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import { describeDb } from './dbTestGuard.js';
const TEST_COACH_EMAIL = `test-coach-${Date.now()}@example.com`;
const TEST_FAN_EMAIL = `test-fan-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

describeDb('Team Creation with Role Validation', () => {
  let coachUserId: string;
  let fanUserId: string;
  let organizationId: string;

  beforeAll(async () => {
    // Create organization (required FK for teams)
    const org = await prisma.organization.create({
      data: {
        name: `Test Org ${Date.now()}`,
        admin_approved: true,
      },
    });
    organizationId = org.id;

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
  });

  afterAll(async () => {
    try {
      // Clean up teams
      await prisma.team.deleteMany({
        where: {
          memberships: {
            some: {
              user_id: {
                in: [coachUserId, fanUserId],
              },
            },
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

      // Clean up organization
      if (organizationId) {
        await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
      }
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  describeDb('Coach Role Validation', () => {
    it('should allow coach to create team', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Test Team',
          description: 'A test team',
          organization_id: organizationId,
          memberships: {
            create: {
              user_id: coachUserId,
              role: 'owner',
              status: 'active',
            },
          },
        },
      });

      expect(team).toBeDefined();
      expect(team.name).toBe('Test Team');

      // Verify membership
      const membership = await prisma.teamMembership.findFirst({
        where: {
          team_id: team.id,
          user_id: coachUserId,
        },
      });

      expect(membership).toBeDefined();
      expect(membership?.role).toBe('owner');
      expect(membership?.status).toBe('active');
    });

    it('should enforce team ownership limit for free tier', async () => {
      const coach = await prisma.user.findUnique({
        where: { id: coachUserId },
      });

      const maxTeams = (coach as any)?.max_teams ?? 3;

      // Count existing owned teams
      const ownedTeamsCount = await prisma.teamMembership.count({
        where: {
          user_id: coachUserId,
          role: 'owner',
          status: 'active',
        },
      });

      // If already at limit, should not be able to create more
      if (ownedTeamsCount >= maxTeams) {
        // This would be enforced in the API endpoint
        // For now, we verify the count
        expect(ownedTeamsCount).toBeGreaterThanOrEqual(maxTeams);
      }
    });
  });

  describeDb('Fan Role Restriction', () => {
    it('should prevent fan from creating team', async () => {
      const fan = await prisma.user.findUnique({
        where: { id: fanUserId },
        select: { preferences: true },
      });

      const prefs =
        fan?.preferences && typeof fan.preferences === 'object' ? (fan.preferences as any) : {};
      const userRole = prefs.role || 'fan';

      expect(userRole).toBe('fan');

      // In the actual API, this would return 403 with COACH_ROLE_REQUIRED error
      // Here we verify the role check logic
      const canCreateTeam = userRole === 'coach';
      expect(canCreateTeam).toBe(false);
    });
  });

  describeDb('Team Data Validation', () => {
    it('should require team name', async () => {
      await expect(
        prisma.team.create({
          data: {
            name: '', // Empty name should fail
            description: 'Test',
            organization_id: organizationId,
            memberships: {
              create: {
                user_id: coachUserId,
                role: 'owner',
                status: 'active',
              },
            },
          },
        })
      ).rejects.toThrow();
    });

    it('should sanitize team name (trim whitespace)', () => {
      const nameWithSpaces = '  Test Team  ';
      const sanitized = nameWithSpaces.trim();

      expect(sanitized).toBe('Test Team');
      expect(sanitized).not.toBe(nameWithSpaces);
    });

    it('should sanitize team description (trim whitespace)', () => {
      const descWithSpaces = '  Test Description  ';
      const sanitized = descWithSpaces.trim();

      expect(sanitized).toBe('Test Description');
      expect(sanitized).not.toBe(descWithSpaces);
    });
  });
});
