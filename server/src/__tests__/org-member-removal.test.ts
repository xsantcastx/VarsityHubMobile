/**
 * Phase 2d: an org owner must be able to remove or demote org members/managers.
 * The 2026-07-14 audit found NO endpoint existed to do this (the only
 * organizationMembership mutations outside transfer-ownership were creates), so
 * a fired manager kept org-admin power forever. These contracts pin the new
 * owner-gated, audit-logged endpoints.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'routes', 'organizations.ts'), 'utf8');

describe('org member remove/demote endpoints', () => {
  it('registers DELETE /:id/members/:membershipId', () => {
    expect(src).toMatch(/organizationsRouter\.delete\(\s*'\/:id\/members\/:membershipId'/);
  });
  it('registers PATCH /:id/members/:membershipId', () => {
    expect(src).toMatch(/organizationsRouter\.patch\(\s*'\/:id\/members\/:membershipId'/);
  });
  it('both are owner-gated via isOrganizationOwnerScoped and audit-logged', () => {
    const idx = src.indexOf("'/:id/members/:membershipId'");
    const region = src.slice(idx, idx + 3500);
    expect(region).toMatch(/isOrganizationOwnerScoped/);
    expect(region).toMatch(/logAdminActivityFromReq/);
  });
  it('refuses to remove/relabel an owner (must use transfer-ownership)', () => {
    const idx = src.indexOf("'/:id/members/:membershipId'");
    const region = src.slice(idx, idx + 3500);
    expect(region).toMatch(/role === 'owner'|role === ORGANIZATION_OWNER_ROLE/);
  });
});
