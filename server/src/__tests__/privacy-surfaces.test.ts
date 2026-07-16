/**
 * Phase 3: close the data-leak surfaces the 2026-07-14 audit found.
 *  3a shareLanding: no pending/private game/event/team/post details
 *  3b nearby search: unapproved orgs excluded
 *  3c feed/highlights/posts: private-team posts excluded
 *  3d org invite: authorize before resolving the identifier (no email harvest)
 *  3e org programs: unapproved-org gate + per-team privacy filter
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'src', ...p), 'utf8');

describe('3a shareLanding gates', () => {
  const src = read('routes', 'shareLanding.ts');
  it('game landing requires approved', () => {
    expect(src).toMatch(/approval_status === 'approved'/);
  });
  it('team landing excludes private/archived teams', () => {
    expect(src).toMatch(/is_private/);
  });
  it('event landing excludes cancelled/non-approved', () => {
    expect(src).toMatch(/status !== 'cancelled'/);
  });
  it('post landing excludes private authors + deleted', () => {
    expect(src).toMatch(/isAuthorHiddenFromViewer/);
    expect(src).toMatch(/deleted_at/);
  });
  it('user landing excludes private profiles', () => {
    const idx = src.indexOf('async function userLanding');
    const region = src.slice(idx, idx + 900);
    expect(region).toMatch(/profile_private/);
    expect(region).toMatch(/!user\.deleted_at && !isPrivate/);
  });
});

describe('3b nearby search excludes unapproved orgs', () => {
  it('search/nearby where clause includes admin_approved: true', () => {
    const src = read('routes', 'organizations.ts');
    const idx = src.indexOf("'/search/nearby'");
    const region = src.slice(idx, idx + 1200);
    expect(region).toMatch(/admin_approved:\s*true/);
  });
});

describe('3c private-team posts excluded from feeds', () => {
  it('highlights, posts, and feed bundle all call getExcludedPrivateTeamIds', () => {
    expect(read('routes', 'highlights.ts')).toMatch(/getExcludedPrivateTeamIds/);
    expect(read('routes', 'posts.ts')).toMatch(/getExcludedPrivateTeamIds/);
    expect(read('routes', 'feed.ts')).toMatch(/getExcludedPrivateTeamIds/);
  });
  it('posts ?team_id= path respects team privacy', () => {
    const src = read('routes', 'posts.ts');
    const idx = src.indexOf('if (req.query.team_id)');
    const region = src.slice(idx, idx + 600);
    expect(region).toMatch(/isTeamHiddenFromViewer/);
  });
  it('unified search excludes private-team-linked games, events, and posts', () => {
    const src = read('routes', 'search.ts');
    expect(src).toMatch(/home_team_id:\s*\{\s*notIn:\s*privateTeamExcludeIds/);
    expect(src).toMatch(/away_team_id:\s*\{\s*notIn:\s*privateTeamExcludeIds/);
    expect(src).toMatch(/team_id:\s*\{\s*notIn:\s*privateTeamExcludeIds/);
  });
});

describe('3d org invite authorizes before resolving identifier', () => {
  it('the owner check precedes resolveInviteIdentifier', () => {
    const src = read('routes', 'organizations.ts');
    const inviteIdx = src.indexOf("'/:id/invite'");
    const region = src.slice(inviteIdx, inviteIdx + 2600);
    const ownerCheck = region.indexOf('isOrganizationOwnerScoped');
    // match the actual call, not the explanatory comment
    const resolve = region.indexOf('resolveInviteIdentifier(prisma');
    expect(ownerCheck).toBeGreaterThan(-1);
    expect(resolve).toBeGreaterThan(ownerCheck);
  });
});

describe('3e org programs gate', () => {
  it('checks admin_approved and filters teams by privacy', () => {
    const src = read('routes', 'organizations.ts');
    // The GET handler is the last '/:id/programs' occurrence (POST create is first).
    const idx = src.lastIndexOf("'/:id/programs'");
    const region = src.slice(idx, idx + 2600);
    expect(region).toMatch(/admin_approved/);
    expect(region).toMatch(/isTeamHiddenFromViewer/);
  });
});

describe('3f mention search mirrors unified search privacy', () => {
  it('filters blocked/private/minor users out of mention results', () => {
    const src = read('routes', 'users.ts');
    const idx = src.indexOf("'/search/mentions'");
    const region = src.slice(idx, idx + 1800);
    expect(region).toMatch(/getBlockedUserIds/);
    expect(region).toMatch(/getExcludedPrivateAuthorIds/);
    expect(region).toMatch(/date_of_birth/);
  });
});
