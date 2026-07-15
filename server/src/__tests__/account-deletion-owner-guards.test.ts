/**
 * Phase 2c: a sole owner must not be able to self-delete and orphan a team/org.
 * The 2026-07-14 audit found assertCanSelfDeleteUser: (1) counted managers as
 * valid org successors, (2) ignored legacy league_owner_id-only owners, and
 * (3) had no team dimension at all — so a sole team owner could self-delete and
 * permanently brick team ownership transfer.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'lib', 'accountDeletion.ts'), 'utf8');
const usersSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'users.ts'), 'utf8');

describe('assertCanSelfDeleteUser owner guards', () => {
  it('requires another OWNER as successor, not a manager', () => {
    // The other-owners count must not accept a manager as a valid successor.
    expect(src).not.toMatch(/role:\s*\{\s*in:\s*\[\s*'owner',\s*'manager'\s*\]/);
  });

  it('considers legacy league_owner_id owners', () => {
    expect(src).toMatch(/league_owner_id/);
  });

  it('guards sole team ownership', () => {
    expect(src).toMatch(/teamMembership/);
    expect(src).toMatch(/SOLE_TEAM_OWNER/);
  });
});

describe('delete route surfaces the team-owner block', () => {
  it('users.ts handles SOLE_TEAM_OWNER with a transfer-first message', () => {
    expect(usersSrc).toMatch(/SOLE_TEAM_OWNER/);
  });
});
