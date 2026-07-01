/**
 * Regression guard for audit findings C1 + C2: routes that mutate team/group-chat
 * state must run `requireOnboarded` so a PENDING (unapproved) coach — who can hold
 * an owner membership on their onboarding team — cannot drive them via the API
 * even though the FE hides every coach surface from pending coaches.
 *
 * Structural check over the route sources (mirrors requireOnboarded-bypass.test.ts).
 * The real behavioral gate is requireOnboarded.ts:134 (role==='coach' &&
 * approval_status!=='APPROVED' → 403 APPROVAL_REQUIRED); this test locks in that
 * these specific routes actually wire that middleware.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES_DIR = join(process.cwd(), 'src', 'routes');
const teamMembershipsSrc = readFileSync(join(ROUTES_DIR, 'team-memberships.ts'), 'utf8');
const groupChatsSrc = readFileSync(join(ROUTES_DIR, 'group-chats.ts'), 'utf8');

/**
 * Extract the middleware list for a route: from the given path literal to the
 * first `asyncHandler(` that follows it, then assert requireOnboarded is present.
 */
function routeGuards(src: string, pathLiteral: string): string {
  const startIdx = src.indexOf(pathLiteral);
  if (startIdx === -1) throw new Error(`route path not found: ${pathLiteral}`);
  const handlerIdx = src.indexOf('asyncHandler(', startIdx);
  if (handlerIdx === -1) throw new Error(`asyncHandler not found after ${pathLiteral}`);
  return src.slice(startIdx, handlerIdx);
}

describe('coach-mutating routes require onboarding (C1/C2)', () => {
  it('team join-request APPROVE runs requireOnboarded', () => {
    expect(routeGuards(teamMembershipsSrc, "'/join-requests/:id/approve'")).toContain(
      'requireOnboarded'
    );
  });

  it('team join-request REJECT runs requireOnboarded', () => {
    expect(routeGuards(teamMembershipsSrc, "'/join-requests/:id/reject'")).toContain(
      'requireOnboarded'
    );
  });

  it('group-chat CREATE runs requireOnboarded', () => {
    // Anchor on the POST '/' registration specifically — a bare "'/'" would
    // match the GET '/' list route first.
    const createBlock = groupChatsSrc.match(
      /groupChatsRouter\.post\(\s*'\/',([\s\S]*?)asyncHandler\(/
    );
    expect(createBlock).not.toBeNull();
    expect(createBlock?.[1]).toContain('requireOnboarded');
  });

  it('group-chat ADD MEMBER runs requireOnboarded', () => {
    expect(routeGuards(groupChatsSrc, "'/:chatId/members'")).toContain('requireOnboarded');
  });

  it('group-chat REMOVE MEMBER runs requireOnboarded', () => {
    expect(routeGuards(groupChatsSrc, "'/:chatId/members/:userId'")).toContain(
      'requireOnboarded'
    );
  });

  it('group-chats imports the requireOnboarded middleware', () => {
    expect(groupChatsSrc).toMatch(/import\s*\{\s*requireOnboarded\s*\}\s*from/);
  });
});
