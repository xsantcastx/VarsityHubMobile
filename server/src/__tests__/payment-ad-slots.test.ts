import { describe, expect, it, jest } from '@jest/globals';

let getFullAdSlotDates: typeof import('../lib/adInventory.js').getFullAdSlotDates;
beforeAll(async () => {
  ({ getFullAdSlotDates } = await import('../lib/adInventory.js'));
});
describe('ad slot capacity', () => {
  it('reports dates at the shared cap from campaign counts', async () => {
    const db = {
      $queryRaw: jest.fn(async () => [
        { date: new Date('2026-07-01T00:00:00Z'), count: BigInt(2) },
        { date: new Date('2026-07-02T00:00:00Z'), count: BigInt(1) },
      ]),
    } as any;
    expect(
      await getFullAdSlotDates(db, {
        adId: 'ad-1',
        targetZipCode: '10001',
        isoDates: ['2026-07-01', '2026-07-02'],
      })
    ).toEqual(['2026-07-01']);
  });
  it('empty dates or missing targeting does not query capacity', async () => {
    const db = { $queryRaw: jest.fn() } as any;
    expect(
      await getFullAdSlotDates(db, { adId: 'ad-1', targetZipCode: null, isoDates: ['2026-07-01'] })
    ).toEqual([]);
    expect(
      await getFullAdSlotDates(db, { adId: 'ad-1', targetZipCode: '10001', isoDates: [] })
    ).toEqual([]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
