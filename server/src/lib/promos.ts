import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withDistributedLock } from './distributedLock.js';

// In-process serialization for the per-user redeem path. Pairs with the
// shared Redis lock from withDistributedLock; the local map keeps two
// requests on the same Node process from racing through the lock acquire.
const promoRedeemLocks = new Map<string, Promise<any>>();

type PromoDb = {
  promoCode: Pick<typeof prisma.promoCode, 'findUnique' | 'update' | 'updateMany'>;
  promoRedemption: Pick<
    typeof prisma.promoRedemption,
    'count' | 'create' | 'findMany' | 'deleteMany'
  >;
};

export type PromoPreviewInput = {
  code: string;
  userId: string;
  subtotalCents: number;
  service?: string;
};

export async function previewPromo(input: PromoPreviewInput, db: PromoDb = prisma) {
  const now = new Date();
  const code = (input.code || '').trim().toUpperCase();

  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.enabled) return { valid: false, reason: 'invalid_or_disabled' } as const;
  if (promo.start_at && now < promo.start_at)
    return { valid: false, reason: 'not_started' } as const;
  if (promo.end_at && now > promo.end_at) return { valid: false, reason: 'expired' } as const;
  if (promo.applies_to_service && input.service && promo.applies_to_service !== input.service)
    return { valid: false, reason: 'not_applicable' } as const;
  if (promo.max_redemptions != null && promo.uses >= promo.max_redemptions)
    return { valid: false, reason: 'usage_exhausted' } as const;

  const userUses = await db.promoRedemption.count({
    where: { promo_id: promo.id, user_id: input.userId },
  });
  if (promo.per_user_limit != null && userUses >= promo.per_user_limit)
    return { valid: false, reason: 'user_limit_reached' } as const;

  let discount = 0;
  if (promo.type === 'COMPLIMENTARY') {
    discount = input.subtotalCents;
  } else if (promo.type === 'PERCENT_OFF' && promo.percent_off) {
    discount = Math.floor((input.subtotalCents * promo.percent_off) / 100);
  }

  discount = Math.max(0, Math.min(discount, input.subtotalCents));
  return {
    valid: true,
    reason: 'ok',
    code: promo.code,
    type: promo.type,
    percent_off: promo.percent_off ?? null,
    discount_cents: discount,
    new_total_cents: input.subtotalCents - discount,
  } as const;
}

async function redeemPromoWithDb(input: PromoPreviewInput & { orderId?: string }, db: PromoDb) {
  const upper = (input.code || '').trim().toUpperCase();
  const promo = await db.promoCode.findUnique({ where: { code: upper } });
  if (!promo || !promo.enabled) return { ok: false, error: 'invalid_or_disabled' } as const;

  const preview = await previewPromo({ ...input, code: upper }, db);
  if (!preview.valid) return { ok: false, error: preview.reason } as const;

  // Atomic capacity gate: increment uses only if under max.
  // The WHERE clause makes this a single atomic operation — no check-then-act race.
  if (promo.max_redemptions != null) {
    const updated = await db.promoCode.updateMany({
      where: { id: promo.id, uses: { lt: promo.max_redemptions } },
      data: { uses: { increment: 1 } },
    });
    if (updated.count === 0) {
      return { ok: false, error: 'usage_exhausted' } as const;
    }
  } else {
    await db.promoCode.update({
      where: { id: promo.id },
      data: { uses: { increment: 1 } },
    });
  }

  // Record redemption — unique(promo_id, order_id) catches replays
  try {
    await db.promoRedemption.create({
      data: {
        promo_id: promo.id,
        user_id: input.userId,
        order_id: input.orderId ?? null,
        amount_discounted_cents: preview.discount_cents,
      },
    });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Replay — decrement the uses we just incremented
      await db.promoCode.update({ where: { id: promo.id }, data: { uses: { decrement: 1 } } });
      return { ok: true, alreadyRedeemed: true, ...preview } as const;
    }
    throw err;
  }

  return { ok: true, ...preview } as const;
}

export async function redeemPromo(input: PromoPreviewInput & { orderId?: string }, db?: PromoDb) {
  if (db) return redeemPromoWithDb(input, db);

  // Per-user serialization to close the preview→create TOCTOU window:
  // without a lock, two parallel checkouts for the same (promo, user)
  // both see 0 prior redemptions during previewPromo and both create a
  // fresh PromoRedemption row (the existing @@unique is on
  // [promo_id, order_id], so different orders both succeed). The lock
  // forces the second attempt to wait until the first writes its row,
  // so previewPromo's per_user_limit check then fails closed.
  //
  // Schema-level @@unique([promo_id, user_id]) was rejected because it
  // would break per_user_limit > 1 promos. The lock works for any limit.
  const upper = (input.code || '').trim().toUpperCase();
  const promoForLock = await prisma.promoCode.findUnique({
    where: { code: upper },
    select: { id: true },
  });
  if (!promoForLock) return { ok: false, error: 'invalid_or_disabled' } as const;

  return withDistributedLock(
    {
      namespace: 'promos:redeem',
      key: `${promoForLock.id}:${input.userId}`,
      ttlMs: 30_000,
      localLocks: promoRedeemLocks,
    },
    () =>
      prisma.$transaction(tx => redeemPromoWithDb(input, tx), {
        isolationLevel: 'Serializable',
      })
  );
}

export type ReversePromoRedemptionInput = {
  orderReferences: string[];
};

async function reversePromoRedemptionWithDb(input: ReversePromoRedemptionInput, db: PromoDb) {
  const orderReferences = Array.from(
    new Set((input.orderReferences || []).map(value => String(value || '').trim()).filter(Boolean))
  );

  if (orderReferences.length === 0) {
    return {
      ok: true,
      reversed: false,
      count: 0,
      orderReferences: [],
      promoIds: [],
      reason: 'no_references',
    } as const;
  }

  const redemptions = await db.promoRedemption.findMany({
    where: { order_id: { in: orderReferences } },
    select: { id: true, promo_id: true, order_id: true },
    take: orderReferences.length,
  });

  if (redemptions.length === 0) {
    return {
      ok: true,
      reversed: false,
      count: 0,
      orderReferences,
      promoIds: [],
      reason: 'not_found',
    } as const;
  }

  await db.promoRedemption.deleteMany({
    where: { id: { in: redemptions.map(redemption => redemption.id) } },
  });

  const promoCounts = new Map<string, number>();
  for (const redemption of redemptions) {
    promoCounts.set(redemption.promo_id, (promoCounts.get(redemption.promo_id) || 0) + 1);
  }

  for (const [promoId, count] of promoCounts.entries()) {
    const promo = await db.promoCode.findUnique({
      where: { id: promoId },
      select: { uses: true },
    });
    if (!promo) continue;
    await db.promoCode.update({
      where: { id: promoId },
      data: { uses: Math.max(0, promo.uses - count) },
    });
  }

  return {
    ok: true,
    reversed: true,
    count: redemptions.length,
    orderReferences,
    promoIds: Array.from(promoCounts.keys()),
    reason: 'reversed',
  } as const;
}

export async function reversePromoRedemption(input: ReversePromoRedemptionInput, db?: PromoDb) {
  if (db) return reversePromoRedemptionWithDb(input, db);
  return prisma.$transaction(tx => reversePromoRedemptionWithDb(input, tx), {
    isolationLevel: 'Serializable',
  });
}
