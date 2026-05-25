/**
 * Regression test: ad approval/rejection must claim the pending state before side effects.
 *
 * Why this exists:
 *   `approveAd` and `rejectAd` used to do a read-check-update flow on
 *   `ad.status === 'pending'`. Two admins approving/rejecting concurrently could
 *   both pass the initial check; reject could even issue a Stripe refund for an
 *   ad another admin had already approved.
 *
 *   Fix:
 *   - `approveAd` uses `updateMany({ where: { id, status: 'pending' } })`
 *   - `rejectAd` first claims the pending row inside a transaction, then runs
 *     the refund side effect only after the DB state has transitioned.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractFunctionBody } from './helpers/extractFunctionBody.js';

const serviceSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'approvalService.ts'), 'utf8');

describe('ad approval race guard', () => {
  const approveBody = extractFunctionBody(serviceSrc, 'approveAd');
  const rejectBody = extractFunctionBody(serviceSrc, 'rejectAd');

  it('approveAd uses a pending-only updateMany guard and returns 409 on conflict', () => {
    expect(approveBody).toMatch(/prisma\.ad\.updateMany/);
    expect(approveBody).toMatch(/status:\s*'pending'/);
    expect(approveBody).toMatch(/status:\s*409/);
  });

  it('rejectAd claims the pending row before attempting a refund', () => {
    expect(rejectBody).toMatch(/prisma\.\$transaction\(async \(tx\)/);
    expect(rejectBody).toMatch(/tx\.ad\.updateMany/);
    expect(rejectBody).toMatch(/status:\s*'pending'/);
  });

  it('rejectAd does not call stripe.refunds.create before the guarded transaction block', () => {
    const txIndex = rejectBody.indexOf("const guard = await prisma.$transaction");
    const refundIndex = rejectBody.indexOf('stripe.refunds.create');
    expect(txIndex).toBeGreaterThanOrEqual(0);
    expect(refundIndex).toBeGreaterThan(txIndex);
  });
});
