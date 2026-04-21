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
    expect(teamsSrc).toMatch(/teamsRouter\.put\('\/:id'[\s\S]*?teamMembership\.findFirst\(\{[\s\S]*?status:\s*'active'/);
    expect(teamsSrc).toMatch(/teamsRouter\.delete\('\/:id'[\s\S]*?teamMembership\.findFirst\(\{[\s\S]*?status:\s*'active'/);
    expect(teamsSrc).toMatch(/teamsRouter\.post\('\/:id\/transfer-ownership'[\s\S]*?currentMembership[\s\S]*?status:\s*'active'/);
    expect(teamsSrc).toMatch(/teamsRouter\.post\('\/:id\/transfer-ownership'[\s\S]*?newOwnerMembership[\s\S]*?status:\s*'active'/);
  });

  it('requires active org membership for join-request approve/deny and org transfer-ownership', () => {
    expect(orgsSrc).toMatch(/join-requests\/:requestId\/approve[\s\S]*?membership\.status\s*!==\s*'active'/);
    expect(orgsSrc).toMatch(/join-requests\/:requestId\/deny[\s\S]*?membership\.status\s*!==\s*'active'/);
    expect(orgsSrc).toMatch(/organizationsRouter\.post\('\/:id\/transfer-ownership'[\s\S]*?currentOwnership[\s\S]*?status:\s*'active'/);
    expect(orgsSrc).toMatch(/organizationsRouter\.post\('\/:id\/transfer-ownership'[\s\S]*?newOwnerMembership[\s\S]*?status:\s*'active'/);
  });
});
