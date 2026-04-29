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

  it('join-request approve requires active org membership', () => {
    // Bounded [\s\S]{0,NNN}? keeps the regex from backtracking forever across
    // the 67KB+ routes file and hitting Jest's test timeout before reporting.
    expect(orgsSrc).toMatch(
      /\/join-requests\/:requestId\/approve[\s\S]{0,4000}?membership\.status\s*!==\s*'active'/
    );
    expect(orgsSrc).toMatch(
      /\/join-requests\/:requestId\/approve[\s\S]{0,4000}?membership\.role\s*!==\s*'owner'/
    );
  });

  it('join-request deny requires active org membership', () => {
    expect(orgsSrc).toMatch(
      /\/join-requests\/:requestId\/deny[\s\S]{0,4000}?membership\.status\s*!==\s*'active'/
    );
    expect(orgsSrc).toMatch(
      /\/join-requests\/:requestId\/deny[\s\S]{0,4000}?membership\.role\s*!==\s*'owner'/
    );
  });

  it('coach-request review routes require owner role on org membership', () => {
    expect(orgsSrc).toMatch(/\/:id\/join-requests[\s\S]{0,2500}?membership\.role\s*!==\s*'owner'/);
    expect(orgsSrc).toMatch(/\/:id\/pending-coaches[\s\S]{0,2500}?role:\s*'owner'/);
    expect(orgsSrc).toMatch(/\/:id\/coaches\/:userId\/approve[\s\S]{0,2500}?role:\s*'owner'/);
    expect(orgsSrc).toMatch(/\/:id\/coaches\/:userId\/reject[\s\S]{0,2500}?role:\s*'owner'/);
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
