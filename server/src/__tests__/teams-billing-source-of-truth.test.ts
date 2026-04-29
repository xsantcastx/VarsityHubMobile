import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const teamsRoute = readFileSync(join(process.cwd(), 'src', 'routes', 'teams.ts'), 'utf8');

describe('teams billing source of truth', () => {
  it('POST /teams reads canonical billing columns before enforcing team limits', () => {
    expect(teamsRoute).toMatch(/select:\s*\{[\s\S]{0,300}plan:\s*true/);
    expect(teamsRoute).toMatch(/select:\s*\{[\s\S]{0,400}pending_plan:\s*true/);
    expect(teamsRoute).toMatch(/select:\s*\{[\s\S]{0,500}payment_pending:\s*true/);
    expect(teamsRoute).toMatch(/select:\s*\{[\s\S]{0,600}payment_approved:\s*true/);
    expect(teamsRoute).toContain('const userPlan = getEffectiveEntitledPlan(me as any);');
  });

  it('POST /teams no longer trusts mutable preferences.plan for entitlement checks', () => {
    expect(teamsRoute).not.toContain('const userPlan = userPrefs.plan ||');
  });
});
