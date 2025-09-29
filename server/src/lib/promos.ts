import { prisma } from '../lib/prisma.js';

export type PromoPreviewInput = {
  code: string;
  userId: string;
  subtotalCents: number;
  service?: string;
};

export async function previewPromo(input: PromoPreviewInput) {
  const now = new Date();
  const code = (input.code || '').trim().toUpperCase();

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.enabled) return { valid: false, reason: 'invalid_or_disabled' } as const;
  if (promo.start_at && now < promo.start_at) return { valid: false, reason: 'not_started' } as const;
  if (promo.end_at && now > promo.end_at) return { valid: false, reason: 'expired' } as const;
  if (promo.applies_to_service && input.service && promo.applies_to_service !== input.service)
    return { valid: false, reason: 'not_applicable' } as const;
  if (promo.max_redemptions != null && promo.uses >= promo.max_redemptions)
    return { valid: false, reason: 'usage_exhausted' } as const;

  const userUses = await prisma.promoRedemption.count({
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

export async function redeemPromo(input: PromoPreviewInput & { orderId?: string }) {
  return prisma.$transaction(async (tx) => {
    const upper = (input.code || '').trim().toUpperCase();
    const promo = await tx.promoCode.findUnique({ where: { code: upper } });
    if (!promo || !promo.enabled) return { ok: false, error: 'invalid_or_disabled' } as const;

    const preview = await previewPromo({ ...input, code: upper });
    if (!preview.valid) return { ok: false, error: preview.reason } as const;

    if (promo.max_redemptions != null) {
      const updated = await tx.promoCode.updateMany({
        where: { id: promo.id, uses: { lt: promo.max_redemptions } },
        data: { uses: { increment: 1 } },
      });
      if (updated.count === 0) return { ok: false, error: 'usage_exhausted' } as const;
    }

    await tx.promoRedemption.create({
      data: {
        promo_id: promo.id,
        user_id: input.userId,
        order_id: input.orderId ?? null,
        amount_discounted_cents: preview.discount_cents,
      },
    });

    return { ok: true, ...preview } as const;
  });
}
