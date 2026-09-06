import { Prisma, type AdStatus } from '@prisma/client';
import { prisma } from './prisma.js';

const MAX_AD_SLOTS = 2;
type InventoryDb = Pick<Prisma.TransactionClient, '$queryRaw'>;

/** Count campaigns, not checkout attempts. UNION deduplicates overlapping holds. */
export async function getAdSlotCounts(
  db: InventoryDb,
  params: { targetZipCode: string; isoDates: string[]; adId?: string }
) {
  return getAdSlotCountsForZips(db, {
    targetZipCodes: [params.targetZipCode],
    isoDates: params.isoDates,
    adId: params.adId,
  });
}

export async function getAdSlotCountsForZips(
  db: InventoryDb,
  params: { targetZipCodes: string[]; isoDates: string[]; adId?: string }
): Promise<Array<{ date: Date; count: bigint; target_zip_code: string }>> {
  if (!params.isoDates.length || !params.targetZipCodes.length) return [];
  const dates = params.isoDates.map(date => Prisma.sql`${date}::date`);
  return db.$queryRaw`
    SELECT inventory.target_zip_code, inventory.date, COUNT(DISTINCT inventory.ad_id) AS count
    FROM (
      SELECT r.ad_id, r.date, a.target_zip_code FROM "AdReservation" r JOIN "Ad" a ON a.id = r.ad_id
      WHERE a.target_zip_code IN (${Prisma.join(params.targetZipCodes)})
        AND a.payment_status IN ('paid', 'hold', 'pending_approval')
        AND r.date IN (${Prisma.join(dates)})
      UNION
      SELECT h.ad_id, h.date, a.target_zip_code FROM "AdSlotHold" h JOIN "Ad" a ON a.id = h.ad_id
      WHERE a.target_zip_code IN (${Prisma.join(params.targetZipCodes)})
        AND h.expires_at > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AND h.date IN (${Prisma.join(dates)})
    ) inventory
    WHERE inventory.ad_id <> ${params.adId || ''}
    GROUP BY inventory.target_zip_code, inventory.date
  `;
}

export function isRefundedAdPurchase(
  purchase: { status: string; metadata: unknown } | null | undefined
) {
  const metadata = purchase?.metadata as Record<string, unknown> | null;
  return (
    purchase?.status === 'REFUNDED' ||
    !!metadata?.stripe_refund_id ||
    !!metadata?.refunded_at ||
    metadata?.release_pending === true
  );
}

export function refundedAdPurchaseError() {
  return Object.assign(new Error('AD_PURCHASE_REFUNDED'), {
    code: 'AD_PURCHASE_REFUNDED',
    statusCode: 409,
    body: { error: 'This purchase was refunded and cannot be activated again.' },
  });
}

export async function getFullAdSlotDates(
  db: InventoryDb,
  params: { adId: string; targetZipCode?: string | null; isoDates: string[] }
): Promise<string[]> {
  if (!params.targetZipCode) return [];
  const counts = await getAdSlotCounts(db, { ...params, targetZipCode: params.targetZipCode });
  return counts
    .filter(row => Number(row.count) >= MAX_AD_SLOTS)
    .map(row => row.date.toISOString().slice(0, 10));
}

export function slotFullError(dates: string[]) {
  return Object.assign(new Error('SLOT_FULL'), { slotFull: true, dates });
}

/** Caller uses SERIALIZABLE so retargeting, checkout and settlement cannot oversell. */
export async function reserveAdSlots(
  tx: Prisma.TransactionClient,
  params: {
    adId: string;
    targetZipCode?: string | null;
    isoDates: string[];
    paymentStatus: 'hold' | 'paid';
    purchaseReference?: string;
    stripePaymentIntentId?: string;
    expiresAt?: Date;
    status?: AdStatus;
  }
) {
  const purchases =
    params.paymentStatus === 'paid' && params.purchaseReference
      ? await tx.transactionLog.findMany({
          where: {
            transaction_type: 'AD_PURCHASE',
            OR: [
              { stripe_session_id: params.purchaseReference },
              { stripe_payment_intent_id: params.purchaseReference },
            ],
          },
          orderBy: { created_at: 'desc' },
          take: 100,
        })
      : [];
  if (purchases.some(isRefundedAdPurchase)) throw refundedAdPurchaseError();
  if (purchases.length === 100) throw new Error('AD_PURCHASE_REQUIRES_REVIEW');
  const purchase = purchases[0];
  if (purchases.some(row => row.status === 'COMPLETED')) return;
  // Read targeting in the same transaction: the quote may predate a ZIP edit.
  const ad = await tx.ad.findUniqueOrThrow({ where: { id: params.adId } });
  // A campaign occupies one slot per day, but every purchase needs exclusive
  // ownership of those dates. Otherwise skipDuplicates loses payment provenance.
  const requestedDates = params.isoDates.map(date => new Date(`${date}T00:00:00.000Z`));
  const overlaps = await tx.adReservation.findMany({
    where: {
      ad_id: params.adId,
      date: { in: requestedDates },
      OR: [
        { purchase_reference: null },
        { purchase_reference: { not: params.purchaseReference || '' } },
      ],
    },
    select: { date: true },
    take: 57,
  });
  const competingHolds =
    params.paymentStatus === 'hold'
      ? await tx.adSlotHold.findMany({
          where: {
            ad_id: params.adId,
            date: { in: requestedDates },
            purchase_reference: { not: params.purchaseReference || '' },
            expires_at: { gt: new Date() },
          },
          select: { date: true },
          take: 57,
        })
      : [];
  if (overlaps.length || competingHolds.length) {
    throw Object.assign(
      slotFullError([
        ...new Set(
          [...overlaps, ...competingHolds].map(row => row.date.toISOString().slice(0, 10))
        ),
      ]),
      {
        code: 'AD_DATES_ALREADY_BOOKED',
        message: 'Selected dates are already paid or booked for this ad.',
      }
    );
  }
  const fullDates = await getFullAdSlotDates(tx, { ...params, targetZipCode: ad.target_zip_code });
  if (fullDates.length) throw slotFullError(fullDates);
  if (params.paymentStatus === 'hold') {
    if (!params.purchaseReference) throw new Error('Ad hold requires a purchase reference');
    await tx.adSlotHold.createMany({
      data: params.isoDates.map(date => ({
        ad_id: ad.id,
        date: new Date(`${date}T00:00:00.000Z`),
        purchase_reference: params.purchaseReference!,
        expires_at: params.expiresAt || new Date(Date.now() + 60 * 60 * 1000),
      })),
      skipDuplicates: true,
    });
    // A new checkout never suspends delivery of inventory already purchased.
    await tx.ad.update({
      where: { id: ad.id },
      data:
        ad.payment_status === 'paid'
          ? {}
          : { payment_status: 'hold', ...(params.status ? { status: params.status } : {}) },
    });
    return;
  }
  await tx.adReservation.createMany({
    data: params.isoDates.map(date => ({
      ad_id: ad.id,
      date: new Date(`${date}T00:00:00.000Z`),
      purchase_reference: params.purchaseReference || null,
    })),
    skipDuplicates: true,
  });
  if (params.purchaseReference) {
    await tx.adSlotHold.deleteMany({
      where: { ad_id: ad.id, purchase_reference: params.purchaseReference },
    });
  }
  await tx.ad.update({
    where: { id: ad.id },
    data: {
      payment_status: 'paid',
      ...(params.status ? { status: params.status } : {}),
    },
  });
  if (purchase) {
    await tx.transactionLog.update({
      where: { id: purchase.id },
      data: {
        status: 'COMPLETED',
        ...(params.stripePaymentIntentId
          ? { stripe_payment_intent_id: params.stripePaymentIntentId }
          : {}),
      },
    });
  }
}

/** Never touches AdReservation: legacy mixed inventory is retained for reconciliation. */
export async function releaseAdPurchaseHolds(
  adId: string,
  purchaseReference: string,
  failPendingPurchase = false
) {
  return prisma.$transaction(
    async tx => {
      await tx.adSlotHold.deleteMany({
        where: { ad_id: adId, purchase_reference: purchaseReference },
      });
      if (failPendingPurchase)
        await tx.transactionLog.updateMany({
          where: {
            transaction_type: 'AD_PURCHASE',
            status: 'PENDING',
            OR: [
              { stripe_session_id: purchaseReference },
              { stripe_payment_intent_id: purchaseReference },
            ],
          },
          data: { status: 'FAILED' },
        });
      await resetAdWithoutInventory(tx, adId);
    },
    { isolationLevel: 'Serializable' }
  );
}

async function resetAdWithoutInventory(tx: Prisma.TransactionClient, adId: string | string[]) {
  await tx.ad.updateMany({
    where: {
      id: Array.isArray(adId) ? { in: adId } : adId,
      payment_status: 'hold',
      reservations: { none: {} },
      slot_holds: { none: { expires_at: { gt: new Date() } } },
    },
    data: { payment_status: 'unpaid' },
  });
}

export async function releaseExpiredAdPurchaseHolds(now = new Date()) {
  return prisma.$transaction(
    async tx => {
      const expired = await tx.adSlotHold.findMany({
        where: { expires_at: { lte: now } },
        select: { id: true, ad_id: true },
        take: 1000,
      });
      const result = await tx.adSlotHold.deleteMany({
        where: { id: { in: expired.map(hold => hold.id) }, expires_at: { lte: now } },
      });
      await resetAdWithoutInventory(tx, [...new Set(expired.map(hold => hold.ad_id))]);
      return result;
    },
    { isolationLevel: 'Serializable' }
  );
}
