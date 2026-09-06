/**
 * Regression: admin privilege must always require a VERIFIED email.
 * getIsAdmin() enforces email_verified; the bare isEmailAdmin() does not.
 * 2026-07-13 audit found four read paths using the bare check on fresh user
 * lookups. These contracts pin every games.ts/organizations.ts admin check
 * to the verified helpers.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Load the shared dependency before its consumers to avoid Jest's ESM linking race.
const { prisma } = await import('../lib/prisma.js');
await import('../lib/userAuthState.js');
await import('../lib/userBillingState.js');
await import('../lib/planDefinitions.js');
await import('../lib/appReviewFixture.js');
const { PLATFORM_ADMIN_EMAILS } = await import('../lib/adminEmails.js');
const { isVerifiedAdminUser } = await import('../middleware/requireAdmin.js');

const requireAdminSrc = readFileSync(
  join(process.cwd(), 'src', 'middleware', 'requireAdmin.ts'),
  'utf8'
);
const gamesSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');
const eventsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'events.ts'), 'utf8');
const visibilitySrc = readFileSync(
  join(process.cwd(), 'src', 'lib', 'entityVisibility.ts'),
  'utf8'
);
const orgsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'organizations.ts'), 'utf8');
afterEach(() => jest.restoreAllMocks());

describe('verified-admin helper', () => {
  it('exists and checks email_verified', () => {
    expect(requireAdminSrc).toMatch(
      /export async function isVerifiedAdminUser\([\s\S]*?email_verified[\s\S]*?isAdminEmail/
    );
  });
});

describe('games.ts admin checks require verification', () => {
  it('no longer calls the bare isEmailAdmin()/isAdminEmail()', () => {
    expect(gamesSrc).not.toMatch(/\bisEmailAdmin\(/);
    expect(gamesSrc).not.toMatch(/\bisAdminEmail\(/);
  });
  it('game and event routes use the shared verified-admin visibility policy', () => {
    for (const [source, helper] of [
      [gamesSrc, 'canViewGameRecord'],
      [eventsSrc, 'canViewEventRecord'],
    ]) {
      expect(source).toMatch(
        new RegExp(`import\\s*\\{[^}]*${helper}[^}]*\\}\\s*from '../lib/entityVisibility\\.js'`)
      );
      expect(source).toMatch(new RegExp(`await ${helper}\\(`));
      expect(source).not.toMatch(new RegExp(`(?:async )?function ${helper}\\(`));
    }
    expect(visibilitySrc).toMatch(/await isVerifiedAdminUser\(viewerId\)/);
    expect(visibilitySrc).not.toMatch(/\b(?:isEmailAdmin|isAdminEmail)\(/);
  });
});

describe('canonical helper used by shared entity visibility', () => {
  it.each([false, true])(
    'requires email_verified=%s for an otherwise unrelated admin',
    async verified => {
      const userRead = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'admin-visibility-fixture',
        email: PLATFORM_ADMIN_EMAILS[0],
        email_verified: verified,
      } as any);
      expect(await isVerifiedAdminUser('admin-visibility-fixture')).toBe(verified);
      expect(userRead).toHaveBeenCalledWith({
        where: { id: 'admin-visibility-fixture' },
        select: { email: true, email_verified: true },
      });
    }
  );
});

describe('organizations.ts members endpoint requires verification', () => {
  it('the non-member platform-admin fallback uses isVerifiedAdminUser', () => {
    expect(orgsSrc).toMatch(/isVerifiedAdminUser\(/);
  });
});

describe('rsvps.ts admin check requires verification', () => {
  it('uses isVerifiedAdminUser instead of a bare admin-email check', () => {
    const rsvpsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'rsvps.ts'), 'utf8');
    expect(rsvpsSrc).toMatch(/isVerifiedAdminUser\(/);
    expect(rsvpsSrc).not.toMatch(/\bisAdminEmail\(/);
    expect(rsvpsSrc).not.toMatch(/\bisEmailAdmin\(/);
  });
});
