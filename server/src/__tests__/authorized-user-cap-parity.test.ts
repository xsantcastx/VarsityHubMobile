/**
 * Phase 2b: the authorized-user plan cap must be enforced consistently across
 * ALL write paths. The 2026-07-14 audit found:
 *  - invite-accept checked only maxRoster, never maxAuthorizedUsers;
 *  - guardTeamMembershipMutation (direct-add / reactivate) counted active
 *    members but NOT pending invites, so direct-adds double-spent reserved
 *    invite slots;
 *  - the create-team authorized_users array had no length bound.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const entSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'teamEntitlements.ts'), 'utf8');
const teamsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'teams.ts'), 'utf8');

describe('guardTeamMembershipMutation counts pending invites', () => {
  it('includes teamInvite pending count in the authorized pool', () => {
    const start = entSrc.indexOf('maxAuthorizedUsers !== null');
    const block = entSrc.slice(start, start + 700);
    expect(block).toMatch(/teamInvite\.count/);
  });
});

describe('invite-accept enforces the authorized-user cap', () => {
  it('the accept transaction references maxAuthorizedUsers', () => {
    // The accept flow previously only referenced maxRoster.
    const acceptIdx = teamsSrc.indexOf('invites/:inviteId/accept');
    const region = acceptIdx >= 0 ? teamsSrc.slice(acceptIdx, acceptIdx + 6000) : teamsSrc;
    expect(region).toMatch(/maxAuthorizedUsers/);
  });
});

describe('create-team authorized_users array is bounded', () => {
  it('applies a .max() length cap to the authorized_users schema', () => {
    const idx = teamsSrc.indexOf('authorized_users: z');
    const region = idx >= 0 ? teamsSrc.slice(idx, idx + 400) : '';
    expect(region).toMatch(/\.max\(/);
  });
});
