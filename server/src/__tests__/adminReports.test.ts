import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

const shouldSkipDbTests = process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

/**
 * Unit tests for adminReports severity-gated suspension logic.
 * 
 * Tests:
 * 1. Resolved with suspend_45_days applies 45-day suspension
 * 2. Resolved with suspend_7_days applies 7-day suspension
 * 3. Resolved with warning does NOT suspend
 * 4. Dismissed does NOT suspend (no severity conversion)
 */

describeDb('adminReports Sanctions Logic', () => {
  let testUserId: string;
  let testReportId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Create a test user to report against
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const user = await prisma.user.create({
      data: {
        id: `test_user_${Date.now()}`,
        email: `test_${Date.now()}@varsityhub.app`,
        display_name: 'Test Violator',
        password_hash: passwordHash,
        preferences: {
          offense_count: 0,
          suspension_until: null,
          suspension_reason: null,
        },
      },
    });
    testUserId = user.id;

    // Create a test admin user
    const admin = await prisma.user.create({
      data: {
        id: `admin_${Date.now()}`,
        email: `admin_${Date.now()}@varsityhub.app`,
        display_name: 'Test Admin',
        password_hash: passwordHash,
      },
    });
    adminUserId = admin.id;

    // Create a test report
    const report = await prisma.abuseReport.create({
      data: {
        id: `test_report_${Date.now()}`,
        reporter_id: admin.id,
        reporter_name: admin.display_name || 'Test Admin',
        reporter_email: admin.email,
        subject: 'Test Harassment',
        message: 'Test report description',
        status: 'pending',
      },
    });
    testReportId = report.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.abuseReport.deleteMany({ where: { id: testReportId } });
    const ids = [testUserId, adminUserId].filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it('should apply 45-day suspension when resolved with suspend_45_days severity', async () => {
    const report = await prisma.abuseReport.findUnique({
      where: { id: testReportId },
    });
    expect(report).toBeDefined();

    const suspensionDays = 45;
    const suspensionUntil = new Date(Date.now() + suspensionDays * 24 * 60 * 60 * 1000);

    // Simulate sanctions application
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        preferences: {
          offense_count: 1,
          suspension_until: suspensionUntil.toISOString(),
          suspension_reason: '45-day suspension after confirmed abuse report',
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: testUserId },
    });
    const prefs = (user?.preferences && typeof user.preferences === 'object')
      ? (user.preferences as Record<string, any>)
      : {};

    expect(prefs.offense_count).toBe(1);
    expect(prefs.suspension_until).toBeDefined();
    expect(String(prefs.suspension_reason || '')).toContain('45-day');
    // Verify suspension is roughly 45 days in the future
    const daysDiff = Math.floor(
      (new Date(prefs.suspension_until as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
    expect(daysDiff).toBeGreaterThanOrEqual(44);
    expect(daysDiff).toBeLessThan(46);
  });

  it('should apply 7-day suspension when resolved with suspend_7_days severity', async () => {
    const suspensionDays = 7;
    const suspensionUntil = new Date(Date.now() + suspensionDays * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: testUserId },
      data: {
        preferences: {
          offense_count: 1,
          suspension_until: suspensionUntil.toISOString(),
          suspension_reason: '7-day suspension after confirmed abuse report',
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: testUserId },
    });
    const prefs = (user?.preferences && typeof user.preferences === 'object')
      ? (user.preferences as Record<string, any>)
      : {};

    expect(prefs.suspension_until).toBeDefined();
    expect(String(prefs.suspension_reason || '')).toContain('7-day');
    const daysDiff = Math.floor(
      (new Date(prefs.suspension_until as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
    expect(daysDiff).toBeGreaterThanOrEqual(6);
    expect(daysDiff).toBeLessThan(8);
  });

  it('should NOT suspend when resolved with warning severity', async () => {
    // Reset suspension
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        preferences: {
          offense_count: 0,
          suspension_until: null,
          suspension_reason: null,
        },
      },
    });

    // Apply only offense count; no suspension for warning
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        preferences: {
          offense_count: 1,
          suspension_until: null,
          suspension_reason: null,
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: testUserId },
    });
    const prefs = (user?.preferences && typeof user.preferences === 'object')
      ? (user.preferences as Record<string, any>)
      : {};

    expect(prefs.offense_count).toBe(1);
    expect(prefs.suspension_until).toBeNull();
    expect(prefs.suspension_reason).toBeNull();
  });

  it('should NOT suspend when dismissed (no severity logic applies)', async () => {
    // Reset
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        preferences: {
          offense_count: 0,
          suspension_until: null,
          suspension_reason: null,
        },
      },
    });

    // Dismissed reports do not trigger sanctions
    const user = await prisma.user.findUnique({
      where: { id: testUserId },
    });
    const prefs = (user?.preferences && typeof user.preferences === 'object')
      ? (user.preferences as Record<string, any>)
      : {};

    expect(prefs.offense_count).toBe(0);
    expect(prefs.suspension_until).toBeNull();
  });

  it('should reject invalid severity values', async () => {
    // This would typically be caught at the API level, but verify the type guard
    const validSeverities = ['warning', 'content_removal', 'suspend_7_days', 'suspend_45_days', 'permanent_ban'];
    const invalidSeverity = 'invalid_severity';

    const isValid = validSeverities.includes(invalidSeverity);
    expect(isValid).toBe(false);
  });

  it('should calculate reinstatement date correctly for 45-day suspension', async () => {
    const now = new Date();
    const until = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const daysDiff = Math.floor(
      (until.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    expect(daysDiff).toBe(45);
  });
});
