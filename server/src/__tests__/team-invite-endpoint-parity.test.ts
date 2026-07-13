/**
 * Regression: POST /teams/:id/invite and POST /team-invites are two live
 * implementations of the same operation. 2026-07-13 audit found they had
 * drifted (roster limit + role-conflict guard in one; already-member guard
 * in the other). These source contracts pin the guards in BOTH files.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const teamsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'teams.ts'), 'utf8');
const teamInvitesSrc = readFileSync(
  join(process.cwd(), 'src', 'routes', 'team-invites.ts'),
  'utf8'
);

// Slice teams.ts to just the POST /:id/invite handler so assertions can't
// accidentally match a different route in this large file.
const inviteHandlerStart = teamsSrc.indexOf("'/:id/invite'");
const inviteHandler = teamsSrc.slice(inviteHandlerStart, inviteHandlerStart + 12000);

describe('POST /teams/:id/invite parity with POST /team-invites', () => {
  it('enforces the roster limit inside the invite transaction', () => {
    expect(inviteHandlerStart).toBeGreaterThan(-1);
    expect(inviteHandler).toMatch(/entitlement\.maxRoster !== null/);
    expect(inviteHandler).toMatch(/ROSTER_LIMIT_REACHED/);
    expect(inviteHandler).toMatch(/buildRosterLimitError\(/);
  });

  it('rejects a role change on an existing pending invite instead of silently overwriting', () => {
    expect(inviteHandler).toMatch(/INVITE_ROLE_CONFLICT/);
    // The 409 branch must exist in the catch block
    expect(inviteHandler).toMatch(/status\(409\)[\s\S]{0,200}INVITE_ROLE_CONFLICT/);
  });
});

describe('POST /team-invites parity with POST /teams/:id/invite', () => {
  it('rejects inviting someone who is already an active member (ALREADY_MEMBER)', () => {
    expect(teamInvitesSrc).toMatch(/ALREADY_MEMBER/);
    expect(teamInvitesSrc).toMatch(/teamMembership\.findFirst\(/);
  });
});
