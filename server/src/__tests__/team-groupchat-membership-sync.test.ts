/**
 * Phase 2e: team roster membership and group-chat membership must stay in sync.
 * The 2026-07-14 audit found removing/archiving a member never dropped their
 * GroupChatMember row, so ex-staff kept read+write access to the team chat;
 * and direct-add never added the member to the chat (only invite-accept did).
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const teamsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'teams.ts'), 'utf8');
const mSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'team-memberships.ts'), 'utf8');

describe('group-chat removal helper', () => {
  it('teams.ts exports removeUserFromTeamGroupChats', () => {
    expect(teamsSrc).toMatch(/export async function removeUserFromTeamGroupChats/);
  });
});

describe('team-memberships wires chat sync', () => {
  it('DELETE and archive both call removeUserFromTeamGroupChats', () => {
    const calls = mSrc.match(/removeUserFromTeamGroupChats\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
  it('direct-add adds the member to the team group chat', () => {
    expect(mSrc).toMatch(/ensureTeamGroupChatMembershipExternal\(/);
  });
});
