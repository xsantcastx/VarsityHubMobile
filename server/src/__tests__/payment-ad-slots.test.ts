import { describe, expect, it, jest } from '@jest/globals';

import { getFullAdSlotDates } from '../lib/paymentInternals.js';

describe('getFullAdSlotDates', () => {
  it('returns dates that have reached the shared ad slot cap', async () => {
    const db = {
      ad: {
        findMany: jest.fn(async () => [{ id: 'ad-2' }, { id: 'ad-3' }]),
      },
      adReservation: {
        groupBy: jest.fn(async () => [
          { date: new Date('2026-07-01T00:00:00.000Z'), _count: { date: 2 } },
          { date: new Date('2026-07-02T00:00:00.000Z'), _count: { date: 1 } },
        ]),
      },
    } as any;

    await expect(
      getFullAdSlotDates(db, {
        adId: 'ad-1',
        targetZipCode: '10001',
        isoDates: ['2026-07-01', '2026-07-02'],
      })
    ).resolves.toEqual(['2026-07-01']);

    expect(db.ad.findMany).toHaveBeenCalledWith({
      where: {
        target_zip_code: '10001',
        payment_status: { in: ['paid', 'hold', 'pending_approval'] },
        NOT: { id: 'ad-1' },
      },
      select: { id: true },
      take: 100,
    });
  });

  it('skips reservation lookup when there is no target zip or no competition', async () => {
    const db = {
      ad: { findMany: jest.fn(async () => []) },
      adReservation: { groupBy: jest.fn() },
    } as any;

    await expect(
      getFullAdSlotDates(db, { adId: 'ad-1', targetZipCode: null, isoDates: ['2026-07-01'] })
    ).resolves.toEqual([]);
    expect(db.ad.findMany).not.toHaveBeenCalled();

    await expect(
      getFullAdSlotDates(db, { adId: 'ad-1', targetZipCode: '10001', isoDates: ['2026-07-01'] })
    ).resolves.toEqual([]);
    expect(db.adReservation.groupBy).not.toHaveBeenCalled();
  });
});
