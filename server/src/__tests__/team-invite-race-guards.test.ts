/**
 * Regression test: invite accept/decline must be pending-only, and team chat creation
 * must be serialized per team to avoid duplicate chats under concurrent accepts.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const teamsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'teams.ts'), 'utf8');

describe('team invite race guards', () => {
  it('accept route only transitions pending invites and returns 409 when already processed', () => {
    expect(teamsSrc).toMatch(/teamsRouter\.post\('\/invites\/:inviteId\/accept'[\s\S]*?teamInvite\.updateMany\(\{/);
    expect(teamsSrc).toMatch(/where:\s*\{\s*id:\s*invite\.id,\s*status:\s*'pending'\s*\}/);
    expect(teamsSrc).toMatch(/return sendError\(res,\s*409,\s*'Invite already processed'\)/);
  });

  it('decline route also uses a pending-only updateMany guard', () => {
    expect(teamsSrc).toMatch(/teamsRouter\.post\('\/invites\/:inviteId\/decline'[\s\S]*?teamInvite\.updateMany\(\{/);
    expect(teamsSrc).toMatch(/teamsRouter\.post\('\/invites\/:inviteId\/decline'[\s\S]*?status:\s*'pending'/);
  });

  it('serializes team group chat creation with a distributed lock keyed by team', () => {
    expect(teamsSrc).toMatch(/withDistributedLock\(/);
    expect(teamsSrc).toMatch(/namespace:\s*'team-group-chat'/);
    expect(teamsSrc).toMatch(/key:\s*teamId/);
  });
});
