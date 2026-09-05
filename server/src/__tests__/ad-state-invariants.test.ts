/** Behavior contracts for purchased inventory; no source-shape assertions. */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
let prisma: typeof import('../lib/prisma.js').prisma;
let releaseAdPurchaseHolds: typeof import('../lib/adInventory.js').releaseAdPurchaseHolds;
let releaseExpiredAdPurchaseHolds: typeof import('../lib/adInventory.js').releaseExpiredAdPurchaseHolds;
let reserveAdSlots: typeof import('../lib/adInventory.js').reserveAdSlots;
let finalizeAppleAdPurchase: typeof import('../lib/paymentInternals.js').finalizeAppleAdPurchase;
let runFinalizeFromSession: typeof import('../lib/paymentInternals.js').runFinalizeFromSession;

let userId: string;
const adIds: string[] = [];
const run = String(Date.now());
const paidDate = '2035-07-01';
const nextDate = '2035-07-02';
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
beforeAll(async () => {
  ({ prisma } = await import('../lib/prisma.js'));
  ({ releaseAdPurchaseHolds, releaseExpiredAdPurchaseHolds, reserveAdSlots } =
    await import('../lib/adInventory.js'));
  ({ finalizeAppleAdPurchase, runFinalizeFromSession } =
    await import('../lib/paymentInternals.js'));
  const user = await prisma.user.create({
    data: {
      email: `ad-state-${run}@example.test`,
      password_hash: 'no-login',
      email_verified: true,
    },
  });
  userId = user.id;
});
afterAll(async () => {
  if (!userId) return;
  await prisma.appleTransactionClaim.deleteMany({ where: { user_id: userId } });
  await prisma.transactionLog.deleteMany({ where: { user_id: userId } });
  await prisma.ad.deleteMany({ where: { id: { in: adIds } } });
  await prisma.user.delete({ where: { id: userId } });
});
async function campaign(paid = true) {
  const ad = await prisma.ad.create({
    data: {
      user_id: userId,
      status: paid ? 'active' : 'approved',
      payment_status: paid ? 'paid' : 'unpaid',
      reservations: paid
        ? { create: { date: date(paidDate), purchase_reference: 'pi_original' } }
        : undefined,
    },
  });
  adIds.push(ad.id);
  return ad;
}
async function hold(adId: string, reference: string, dates = [nextDate]) {
  await prisma.$transaction(
    tx =>
      reserveAdSlots(tx, {
        adId,
        isoDates: dates,
        paymentStatus: 'hold',
        purchaseReference: reference,
      }),
    { isolationLevel: 'Serializable' }
  );
}
async function snapshot(adId: string) {
  return prisma.ad.findUniqueOrThrow({
    where: { id: adId },
    include: { reservations: { orderBy: { date: 'asc' } }, slot_holds: true },
  });
}
describe('ad payment lifecycle behavior', () => {
  it('cancellation of one Run Again attempt preserves earlier paid dates and another pending attempt', async () => {
    const ad = await campaign();
    await hold(ad.id, 'pi_canceled');
    await hold(ad.id, 'pi_other');
    await releaseAdPurchaseHolds(ad.id, 'pi_canceled');
    await releaseAdPurchaseHolds(ad.id, 'pi_canceled');
    const state = await snapshot(ad.id);
    expect(state).toMatchObject({ status: 'active', payment_status: 'paid' });
    expect(state.reservations.map(row => row.date)).toEqual([date(paidDate)]);
    expect(state.slot_holds.map(row => row.purchase_reference)).toEqual(['pi_other']);
  });
  it('expiry of first-purchase holds returns the ad to approved/unpaid', async () => {
    const ad = await campaign(false);
    await hold(ad.id, 'pi_abandoned');
    await prisma.adSlotHold.updateMany({
      where: { ad_id: ad.id },
      data: { expires_at: new Date(0) },
    });
    await releaseExpiredAdPurchaseHolds();
    expect(await snapshot(ad.id)).toMatchObject({
      status: 'approved',
      payment_status: 'unpaid',
      reservations: [],
      slot_holds: [],
    });
  });
  it('ambiguous pre-migration reservations are retained on legacy cancellation', async () => {
    const ad = await campaign();
    await prisma.ad.update({ where: { id: ad.id }, data: { payment_status: 'hold' } });
    await releaseAdPurchaseHolds(ad.id, 'cs_legacy');
    expect((await snapshot(ad.id)).reservations.map(row => row.date)).toEqual([date(paidDate)]);
  });
  it('a failed settlement rolls back promotion and keeps purchased dates and pending holds', async () => {
    const ad = await campaign();
    await hold(ad.id, 'pi_rollback');
    await expect(
      prisma.$transaction(
        async tx => {
          await reserveAdSlots(tx, {
            adId: ad.id,
            isoDates: [nextDate],
            paymentStatus: 'paid',
            status: 'active',
            purchaseReference: 'pi_rollback',
          });
          throw new Error('simulated process failure before commit');
        },
        { isolationLevel: 'Serializable' }
      )
    ).rejects.toThrow('simulated process failure');
    const state = await snapshot(ad.id);
    expect(state.reservations.map(row => row.date)).toEqual([date(paidDate)]);
    expect(state.slot_holds).toHaveLength(1);
    expect(state.payment_status).toBe('paid');
  });
  it('Checkout Session success and duplicate callbacks add the new dates exactly once', async () => {
    const ad = await campaign();
    const reference = `cs_rerun_${ad.id}`;
    await hold(ad.id, reference);
    await prisma.transactionLog.create({
      data: {
        user_id: userId,
        order_id: ad.id,
        transaction_type: 'AD_PURCHASE',
        status: 'PENDING',
        stripe_session_id: reference,
      },
    });
    const session = {
      id: reference,
      mode: 'payment',
      status: 'complete',
      payment_status: 'paid',
      amount_total: 499,
      metadata: { ad_id: ad.id, user_id: userId, dates: JSON.stringify([nextDate]) },
    };
    await runFinalizeFromSession(session as any);
    await runFinalizeFromSession(session as any);
    await releaseAdPurchaseHolds(ad.id, reference); // Out-of-order expiration is harmless.
    const state = await snapshot(ad.id);
    expect(state).toMatchObject({ status: 'active', payment_status: 'paid', slot_holds: [] });
    expect(state.reservations.map(row => row.date)).toEqual([date(paidDate), date(nextDate)]);
    expect(state.reservations[0].purchase_reference).toBe('pi_original');
    expect(state.reservations[1].purchase_reference).toBe(reference);
  });
  it('Apple Run Again records each purchase and rejects reusing a receipt for different dates', async () => {
    const ad = await campaign();
    const first = {
      userId,
      adId: ad.id,
      dates: [nextDate],
      appleTransactionIds: [`apple_first_${ad.id}`],
      receiptsCount: 1,
    };
    await finalizeAppleAdPurchase(first);
    expect((await finalizeAppleAdPurchase(first)).idempotent).toBe(true);
    await expect(
      finalizeAppleAdPurchase({ ...first, dates: ['2035-07-03'] })
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      finalizeAppleAdPurchase({
        ...first,
        dates: ['2035-07-03'],
        appleTransactionIds: [...first.appleTransactionIds, `apple_mixed_${ad.id}`],
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    await finalizeAppleAdPurchase({
      ...first,
      dates: ['2035-07-03'],
      appleTransactionIds: [`apple_second_${ad.id}`],
    });
    expect((await snapshot(ad.id)).reservations).toHaveLength(3);
    expect(
      await prisma.transactionLog.count({
        where: { user_id: userId, order_id: ad.id, status: 'COMPLETED' },
      })
    ).toBe(2);
  });
  it('a refunded Apple receipt cannot fund a mixed bundle and refund wins over duplicate completed ledger rows', async () => {
    const ad = await campaign();
    const receipt = `apple_refunded_${ad.id}`;
    const freshReceipt = `apple_fresh_${ad.id}`;
    const purchase = {
      userId,
      adId: ad.id,
      dates: [nextDate],
      appleTransactionIds: [receipt],
      receiptsCount: 1,
    };
    await finalizeAppleAdPurchase(purchase);
    await prisma.transactionLog.updateMany({
      where: { apple_transaction_id: receipt },
      data: { status: 'REFUNDED' },
    });
    await prisma.adReservation.deleteMany({
      where: { ad_id: ad.id, purchase_reference: `apple:${receipt}` },
    });
    await expect(
      finalizeAppleAdPurchase({
        ...purchase,
        dates: ['2035-07-03'],
        appleTransactionIds: [receipt, freshReceipt],
        receiptsCount: 2,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      await prisma.appleTransactionClaim.count({ where: { apple_transaction_id: freshReceipt } })
    ).toBe(0);
    await prisma.transactionLog.create({
      data: {
        user_id: userId,
        order_id: ad.id,
        transaction_type: 'AD_PURCHASE',
        status: 'COMPLETED',
        metadata: { dates: [nextDate], apple_transaction_ids: [receipt] },
      },
    });
    await expect(finalizeAppleAdPurchase(purchase)).rejects.toMatchObject({ statusCode: 409 });
    expect((await snapshot(ad.id)).reservations.map(row => row.date)).toEqual([date(paidDate)]);
  });
});
