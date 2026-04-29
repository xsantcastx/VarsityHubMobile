/**
 * P1 audit regression guard — promo redemption TOCTOU.
 *
 * Without per-(promo, user) serialization, two parallel checkouts for
 * the same code can both pass previewPromo's per_user_limit check
 * before either records its PromoRedemption row, granting one user two
 * discounts on a code with per_user_limit = 1. The fix wraps the
 * preview→create→increment sequence in withDistributedLock keyed by
 * promo_id + user_id so the second attempt sees the first's redemption
 * and fails closed.
 *
 * We grep the source rather than running an integration test because
 * provoking the TOCTOU requires concurrent transactions over a real
 * Postgres session and the existing Jest+Prisma harness can't simulate
 * the race reliably. The structural guard locks in the lock acquisition
 * so a future refactor that drops it will fail this suite.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const promosSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'promos.ts'), 'utf8');

describe('promo redemption — TOCTOU guard', () => {
  it('imports the distributed lock helper', () => {
    expect(promosSrc).toMatch(
      /import\s*\{\s*withDistributedLock\s*\}\s*from\s*['"]\.\/distributedLock\.js['"]/
    );
  });

  it('declares a per-process local lock map for the redeem path', () => {
    expect(promosSrc).toMatch(/promoRedeemLocks\s*=\s*new Map/);
  });

  it('redeemPromo wraps the transaction in withDistributedLock keyed by promo + user', () => {
    const fnSlice = promosSrc.slice(promosSrc.indexOf('export async function redeemPromo'));
    expect(fnSlice).toMatch(/withDistributedLock\(/);
    expect(fnSlice).toMatch(/namespace:\s*['"]promos:redeem['"]/);
    expect(fnSlice).toMatch(/key:\s*`\$\{[^}]+\}:\$\{input\.userId\}`/);
    expect(fnSlice).toMatch(/localLocks:\s*promoRedeemLocks/);
  });

  it('serializable isolation is preserved for the inner transaction', () => {
    const fnSlice = promosSrc.slice(promosSrc.indexOf('export async function redeemPromo'));
    expect(fnSlice).toMatch(/isolationLevel:\s*['"]Serializable['"]/);
  });

  it('caller-supplied db (already inside a tx) bypasses the outer lock to avoid deadlock', () => {
    const fnSlice = promosSrc.slice(
      promosSrc.indexOf('export async function redeemPromo'),
      promosSrc.indexOf('export type ReversePromoRedemptionInput')
    );
    // First branch returns the inner-tx variant directly.
    expect(fnSlice).toMatch(/if \(db\) return redeemPromoWithDb\(input, db\)/);
  });
});
