/**
 * A failed ad-reject refund must never be silent (2026-07-09).
 *
 * Before this: rejecting a PAID ad set payment_status:'refund_pending', then
 * attempted a Stripe refund; both failure branches only console.error'd (no
 * Sentry), and nothing ever swept 'refund_pending' — so a failed refund left a
 * real charge stranded, invisible to ops, forever. Audit finding P1.
 *
 * These pin the fix structurally (a behavioral test would need to mock Stripe):
 *   1. the reject path alarms to Sentry on refund failure
 *   2. the refund is idempotent (stable key) so it's safe to re-run
 *   3. a reconciliation sweep exists AND is wired into the scheduler
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const approvalSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'approvalService.ts'), 'utf8');
const schedulerSrc = readFileSync(join(process.cwd(), 'src', 'jobs', 'scheduler.ts'), 'utf8');

/** Body of a named exported/plain async function, comments stripped. */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  // crude but sufficient: grab a generous window and strip // comments
  return src.slice(start, start + 3500).replace(/\/\/.*$/gm, '');
}

describe('ad reject refund is never silently stranded', () => {
  it('rejectAd alarms to Sentry when the refund fails', () => {
    const body = fnBody(approvalSrc, 'rejectAd');
    // On a non-ok refund result, it must captureException, not just console.error.
    expect(body).toMatch(/captureException\(/);
    expect(approvalSrc).toContain("context: 'ad_reject_refund_failed'");
  });

  it('the refund is issued idempotently so a retry cannot double-refund', () => {
    const body = fnBody(approvalSrc, 'issueAdRefund');
    expect(body).toMatch(/idempotencyKey:\s*`ad-refund-\$\{ad\.id\}`/);
    // Idempotency-affecting metadata must be caller-stable (no admin_id).
    expect(body).not.toMatch(/admin_id/);
  });

  it('a reconciliation sweep exists for stuck refund_pending ads and alarms on the unrecoverable', () => {
    expect(approvalSrc).toMatch(/export async function reconcileStuckAdRefunds/);
    const body = fnBody(approvalSrc, 'reconcileStuckAdRefunds');
    expect(body).toMatch(/payment_status:\s*'refund_pending'/);
    expect(body).toMatch(/issueAdRefund\(/);
    expect(body).toMatch(/payment_status:\s*'refunded'/);
    expect(approvalSrc).toContain("context: 'ad_refund_reconcile_stuck'");
  });

  it('the sweep is registered in the scheduler', () => {
    expect(schedulerSrc).toContain("name: 'ad-refund-reconcile'");
    expect(schedulerSrc).toContain('reconcileStuckAdRefunds');
  });
});
