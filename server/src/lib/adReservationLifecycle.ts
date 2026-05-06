import type { Prisma, PrismaClient, AdStatus, AdPaymentStatus } from '@prisma/client';

type ReservationDbClient = PrismaClient | Prisma.TransactionClient;

type ExpiredReservationCleanupResult = {
  adId: string;
  releasedPastDates: number;
  remainingReservations: number;
  status: AdStatus;
  paymentStatus: AdPaymentStatus;
  changed: boolean;
};

function getTodayUtcStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function releaseExpiredPendingApprovalReservationsForAd(
  db: ReservationDbClient,
  adId: string,
  now: Date = new Date(),
): Promise<ExpiredReservationCleanupResult> {
  const ad = await db.ad.findUnique({
    where: { id: adId },
    select: { id: true, status: true, payment_status: true },
  });

  if (!ad) {
    return {
      adId,
      releasedPastDates: 0,
      remainingReservations: 0,
      status: 'draft',
      paymentStatus: 'unpaid',
      changed: false,
    };
  }

  const currentStatus = ad.status as AdStatus;
  const currentPaymentStatus = ad.payment_status as AdPaymentStatus;

  if (currentPaymentStatus !== 'pending_approval') {
    const remainingReservations = await db.adReservation.count({ where: { ad_id: adId } });
    return {
      adId,
      releasedPastDates: 0,
      remainingReservations,
      status: currentStatus,
      paymentStatus: currentPaymentStatus,
      changed: false,
    };
  }

  const todayUtcStart = getTodayUtcStart(now);
  const releasedPastDates = await db.adReservation.count({
    where: {
      ad_id: adId,
      date: { lt: todayUtcStart },
    },
  });

  if (releasedPastDates === 0) {
    const remainingReservations = await db.adReservation.count({ where: { ad_id: adId } });
    return {
      adId,
      releasedPastDates: 0,
      remainingReservations,
      status: currentStatus,
      paymentStatus: currentPaymentStatus,
      changed: false,
    };
  }

  await db.adReservation.deleteMany({
    where: {
      ad_id: adId,
      date: { lt: todayUtcStart },
    },
  });

  const remainingReservations = await db.adReservation.count({ where: { ad_id: adId } });

  let nextStatus: AdStatus = currentStatus;
  let nextPaymentStatus: AdPaymentStatus = currentPaymentStatus;
  const updateData: Record<string, unknown> = {};

  if (remainingReservations === 0) {
    if (currentStatus === 'approved') {
      nextPaymentStatus = 'unpaid';
      updateData.payment_status = 'unpaid';
    } else if (currentStatus === 'pending') {
      nextStatus = 'draft';
      nextPaymentStatus = 'unpaid';
      updateData.status = 'draft';
      updateData.payment_status = 'unpaid';
      updateData.admin_note =
        '[Auto] Pending approval dates expired before payment. Select new dates to continue.';
    }
  }

  if (Object.keys(updateData).length > 0) {
    await db.ad.update({
      where: { id: adId },
      data: updateData,
    });
  }

  return {
    adId,
    releasedPastDates,
    remainingReservations,
    status: nextStatus,
    paymentStatus: nextPaymentStatus,
    changed: true,
  };
}

export async function releaseExpiredPendingApprovalReservations(
  db: ReservationDbClient,
  now: Date = new Date(),
  limit = 1000,
) {
  const todayUtcStart = getTodayUtcStart(now);
  const candidates = await db.ad.findMany({
    where: {
      payment_status: 'pending_approval',
      reservations: {
        some: {
          date: { lt: todayUtcStart },
        },
      },
    },
    select: { id: true },
    take: limit,
  });

  let adsTouched = 0;
  let releasedDates = 0;
  let resetToApprovedUnpaid = 0;
  let resetToDraftUnpaid = 0;

  for (const candidate of candidates) {
    const result = await releaseExpiredPendingApprovalReservationsForAd(db, candidate.id, now);
    if (!result.changed) continue;
    adsTouched += 1;
    releasedDates += result.releasedPastDates;
    if (result.remainingReservations === 0 && result.paymentStatus === 'unpaid') {
      if (result.status === 'approved') resetToApprovedUnpaid += 1;
      if (result.status === 'draft') resetToDraftUnpaid += 1;
    }
  }

  return {
    adsTouched,
    releasedDates,
    resetToApprovedUnpaid,
    resetToDraftUnpaid,
  };
}
