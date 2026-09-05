/**
 * Regression test: critical membership-based mutations must require active memberships.
 *
 * Why this exists:
 *   Several high-impact team/org mutation routes were checking "does a row exist
 *   for this user?" but not consistently requiring `status: 'active'`. That
 *   creates permission drift from sibling routes and can let stale memberships
 *   satisfy ownership/admin checks.
 *
 * This stays structural on purpose: no DB setup, and it fails the moment
 * someone edits one of these permission checks back to a looser query.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES_DIR = join(process.cwd(), 'src', 'routes');
const teamsSrc = readFileSync(join(ROUTES_DIR, 'teams.ts'), 'utf8');
const orgsSrc = readFileSync(join(ROUTES_DIR, 'organizations.ts'), 'utf8');
const orgAuthSrc = readFileSync(
  join(process.cwd(), 'src', 'lib', 'organizationAuthorization.ts'),
  'utf8'
);

describe('membership status guards', () => {
  it('requires active team membership for team update, delete, and transfer-ownership', () => {
    // Allow whitespace between router.method( and the path string — prettier
    // reformats long arg lists across multiple lines.
    expect(teamsSrc).toMatch(
      /teamsRouter\.put\(\s*'\/:id'[\s\S]*?teamMembership\.findFirst\(\{[\s\S]*?status:\s*'active'/
    );
    expect(teamsSrc).toMatch(
      /teamsRouter\.delete\(\s*'\/:id'[\s\S]*?teamMembership\.findFirst\(\{[\s\S]*?status:\s*'active'/
    );
    expect(teamsSrc).toMatch(
      /teamsRouter\.post\(\s*'\/:id\/transfer-ownership'[\s\S]*?currentMembership[\s\S]*?status:\s*'active'/
    );
    expect(teamsSrc).toMatch(
      /teamsRouter\.post\(\s*'\/:id\/transfer-ownership'[\s\S]*?newOwnerMembership[\s\S]*?status:\s*'active'/
    );
  });

  // 2026-07-09: the inline `membership.status !== 'active' && membership.role
  // !== 'owner'` checks on approve/deny/review were replaced by the shared
  // isOrganizationOwnerScoped() helper (so legacy league_owner_id owners are
  // recognized too, PR #142). The ACTIVE-OWNER invariant is preserved — it now
  // lives in the helper, which the final assertion below pins. Bounded
  // [\s\S]{0,NNN}? keeps the regex from backtracking across the 67KB+ file.
  it('join-request approve gates on the org-owner helper', () => {
    expect(orgsSrc).toMatch(
      /\/join-requests\/:requestId\/approve[\s\S]{0,4000}?isOrganizationOwnerScoped\(/
    );
  });

  it('join-request deny gates on the org-owner helper', () => {
    expect(orgsSrc).toMatch(
      /\/join-requests\/:requestId\/deny[\s\S]{0,4000}?isOrganizationOwnerScoped\(/
    );
  });

  it('coach-request review routes gate on the org-owner helper', () => {
    expect(orgsSrc).toMatch(/\/:id\/join-requests[\s\S]{0,2500}?isOrganizationOwnerScoped\(/);
  });

  it('canonical owner queries select only ACTIVE OWNER memberships before the legacy fallback', () => {
    const singleStart = orgAuthSrc.indexOf('export async function getOrganizationOwner(');
    const batchStart = orgAuthSrc.indexOf('export async function getOwnedOrganizationIds(');
    const wrapperStart = orgAuthSrc.indexOf('export async function isOrganizationOwner(');
    for (const body of [
      orgAuthSrc.slice(singleStart, batchStart),
      orgAuthSrc.slice(batchStart, wrapperStart),
    ]) {
      expect(body).toMatch(/m\.role = 'owner' AND m\.status = 'active'/);
      expect(body).toMatch(
        /COALESCE\([\s\S]*?SELECT m\.user_id[\s\S]*?LIMIT 1\),\s*o\.league_owner_id/
      );
    }
    expect(orgAuthSrc.slice(wrapperStart)).toMatch(
      /return \(await getOrganizationOwner\(orgId\)\)\?\.id === userId/
    );
  });

  it('org transfer-ownership requires active current + new owner memberships', () => {
    // Allow whitespace between post( and the path string — the org route is
    // declared across several lines (organizations.ts:2038), unlike the teams
    // route which is single-line.
    expect(orgsSrc).toMatch(
      /organizationsRouter\.post\(\s*'\/:id\/transfer-ownership'[\s\S]{0,2000}?currentOwnership[\s\S]{0,500}?status:\s*'active'/
    );
    expect(orgsSrc).toMatch(
      /organizationsRouter\.post\(\s*'\/:id\/transfer-ownership'[\s\S]{0,2000}?newOwnerMembership[\s\S]{0,500}?status:\s*'active'/
    );
  });
});
