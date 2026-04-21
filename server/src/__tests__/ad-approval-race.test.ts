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

const serviceSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'approvalService.ts'), 'utf8');

function extractFunctionBody(source: string, name: string): string {
  const startPattern = new RegExp(`export async function ${name}\\b`);
  const startMatch = source.match(startPattern);
  if (!startMatch || startMatch.index === undefined) {
    throw new Error(`Could not locate function ${name} in approvalService.ts`);
  }
  const tail = source.slice(startMatch.index);
  const bodyStart = tail.search(/\)\s*\{/);
  const firstBrace = bodyStart === -1 ? -1 : tail.indexOf('{', bodyStart);
  if (firstBrace === -1) throw new Error(`Malformed function ${name}`);
  let depth = 0;
  for (let i = firstBrace; i < tail.length; i++) {
    const ch = tail[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return tail.slice(0, i + 1);
    }
  }
  throw new Error(`Could not find end of function ${name}`);
}

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
