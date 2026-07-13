/**
 * Regression: admin privilege must always require a VERIFIED email.
 * getIsAdmin() enforces email_verified; the bare isEmailAdmin() does not.
 * 2026-07-13 audit found four read paths using the bare check on fresh user
 * lookups. These contracts pin every games.ts/organizations.ts admin check
 * to the verified helpers.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const requireAdminSrc = readFileSync(
  join(process.cwd(), 'src', 'middleware', 'requireAdmin.ts'),
  'utf8'
);
const gamesSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');
const orgsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'organizations.ts'), 'utf8');

describe('verified-admin helper', () => {
  it('exists and checks email_verified', () => {
    expect(requireAdminSrc).toMatch(
      /export async function isVerifiedAdminUser\([\s\S]*?email_verified[\s\S]*?isAdminEmail/
    );
  });
});

describe('games.ts admin checks require verification', () => {
  it('no longer calls the bare isEmailAdmin()', () => {
    expect(gamesSrc).not.toMatch(/\bisEmailAdmin\(/);
  });
  it('canViewGameRecord uses isVerifiedAdminUser', () => {
    const start = gamesSrc.indexOf('async function canViewGameRecord');
    const fn = gamesSrc.slice(start, start + 3000);
    expect(fn).toMatch(/isVerifiedAdminUser\(/);
  });
});

describe('organizations.ts members endpoint requires verification', () => {
  it('the non-member platform-admin fallback uses isVerifiedAdminUser', () => {
    expect(orgsSrc).toMatch(/isVerifiedAdminUser\(/);
  });
});
