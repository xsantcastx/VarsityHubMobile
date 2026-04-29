import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const approvalServiceSrc = readFileSync(
  join(process.cwd(), 'src', 'lib', 'approvalService.ts'),
  'utf8'
);
const organizationRoutesSrc = readFileSync(
  join(process.cwd(), 'src', 'routes', 'organizations.ts'),
  'utf8'
);

describe('organization final-state guards', () => {
  it('approveOrganization refuses already-rejected leagues and keeps the DB guard aligned', () => {
    const approveOrgSlice = approvalServiceSrc.slice(
      approvalServiceSrc.indexOf('export async function approveOrganization'),
      approvalServiceSrc.indexOf('export async function rejectOrganization')
    );
    expect(approveOrgSlice).toContain(
      "if (org.status === 'rejected') return { error: 'Organization already rejected'"
    );
    expect(approveOrgSlice).toContain(
      "where: { id: orgId, admin_approved: false, status: { not: 'rejected' } }"
    );
  });

  it('rejectOrganization refuses already-approved leagues and keeps the DB guard aligned', () => {
    const start = approvalServiceSrc.indexOf('export async function rejectOrganization');
    const end = approvalServiceSrc.indexOf('  // ── Fire-and-forget notifications ──', start);
    const rejectOrgSlice = approvalServiceSrc.slice(start, end);
    expect(rejectOrgSlice).toContain(
      "if (org.admin_approved) return { error: 'Organization already approved'"
    );
    expect(rejectOrgSlice).toContain(
      "where: { id: orgId, status: { not: 'rejected' }, admin_approved: false }"
    );
  });

  it('league email routes map service-level final states back to explicit pages', () => {
    expect(organizationRoutesSrc).toContain("if (finalState === 'rejected')");
    expect(organizationRoutesSrc).toContain("if (finalState === 'approved')");
    // Allow prettier to break the call across multiple lines.
    expect(organizationRoutesSrc).toMatch(
      /renderLeagueActionResultPage\(\s*'Already Rejected',\s*'This league was already rejected\.',\s*false\s*\)/
    );
    expect(organizationRoutesSrc).toMatch(
      /renderLeagueActionResultPage\(\s*'Already Approved',\s*'This league was already approved\.',\s*false\s*\)/
    );
  });
});
