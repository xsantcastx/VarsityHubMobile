/**
 * Approval-audit P3 follow-ups (2026-07-15). Source-shape invariants pinning the
 * lower-severity hardening fixes, robust to local test-DB migration drift.
 *
 * Policy note: org auto-approve on subsequent creation is OWNER-CONFIRMED
 * INTENTIONAL (2026-07-15) — these tests pin its *auditability*, not its removal.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');

function sliceFunction(source: string, signature: string, span = 6000): string {
  const start = source.indexOf(signature);
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, start + span);
}

const approvalService = read('lib', 'approvalService.ts');
const organizations = read('routes', 'organizations.ts');

describe('Org auto-approve stays auditable (intended behavior)', () => {
  it('auto-approved orgs carry a sentinel approver instead of a null approved_by', () => {
    const builder = sliceFunction(organizations, 'function buildOrganizationCreateData');
    expect(builder).toMatch(/approved_by:\s*adminApproved \? 'auto:approved-coach' : null/);
  });

  it('org creation emits an APPROVE_LEAGUE audit row on the auto-approve branch', () => {
    expect(organizations).toMatch(/if \(preserveApprovedFinalSetup\)/);
    expect(organizations).toMatch(/'APPROVE_LEAGUE'/);
    expect(organizations).toMatch(/auto_approve_subsequent_org/);
  });
});

describe('approveOrganization fails closed on an ownerless org', () => {
  it('refuses (409) and alarms rather than publishing a headless org', () => {
    const fn = sliceFunction(approvalService, 'export async function approveOrganization');
    expect(fn).toMatch(/!owner\?\.id && !org\.league_owner_id/);
    expect(fn).toMatch(/ownerless/i);
    expect(fn).toMatch(/status:\s*409/);
  });
});

describe('Ad email-token self-approval IDOR is closed for admin-owned ads', () => {
  it('approveAd blocks admin-owned ads on the identity-less token path', () => {
    const fn = sliceFunction(approvalService, 'export async function approveAd');
    // On the token path adminId is null; an admin-owned ad must go through the
    // signed-in dashboard where the self-approval guard can run.
    expect(fn).toMatch(/if \(!adminId && ad\.user_id\)/);
    expect(fn).toMatch(/isAdminEmail\(owner\.email\)/);
    expect(fn).toMatch(/must be approved from the signed-in dashboard/);
  });

  it('rejectAd applies the same identity-less-path guard', () => {
    const fn = sliceFunction(approvalService, 'export async function rejectAd');
    expect(fn).toMatch(/if \(!adminId && ad\.user_id\)/);
    expect(fn).toMatch(/isAdminEmail\(owner\.email\)/);
  });
});

describe('Ad refund reconcile drains an already-refunded stuck ad', () => {
  it('issueAdRefund distinguishes an already-refunded tx from an unrecoverable one', () => {
    const fn = sliceFunction(approvalService, 'async function issueAdRefund');
    // A REFUNDED tx with no COMPLETED sibling means the money already went back;
    // signal that distinctly instead of the generic no_payment_intent_found.
    expect(fn).toMatch(/status:\s*'REFUNDED'/);
    expect(fn).toMatch(/error:\s*'already_refunded'/);
  });

  it('reconcileStuckAdRefunds drains ad -> refunded on already_refunded (no hourly re-alarm)', () => {
    const fn = sliceFunction(approvalService, 'export async function reconcileStuckAdRefunds');
    expect(fn).toMatch(/res\.error === 'already_refunded'/);
    expect(fn).toMatch(/payment_status:\s*'refunded'/);
    expect(fn).toMatch(/recovered\+\+/);
  });
});
