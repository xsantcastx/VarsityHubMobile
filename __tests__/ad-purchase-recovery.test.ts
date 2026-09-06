import { recoverAdReceipt, reviseAdIntentDates } from '@/lib/adPurchaseRecovery';
import { httpPost } from '@/api/http';
jest.mock('expo-modules-core', () => ({ uuid: { v4: jest.fn() } }));
jest.mock('@/api/http', () => ({ httpPost: jest.fn() }));
const purchase = {
  appAccountToken: '5370f74c-783a-4fab-9bd9-019014e3ef6b',
  purchaseToken: 'signed-test-payload',
};
const intent: any = { id: purchase.appAccountToken, status: 'pending' };

it('never acknowledges StoreKit while the server write is pending or failed', async () => {
  let reject!: (error: Error) => void;
  const save = jest.fn(
    () =>
      new Promise<any>((_, fail) => {
        reject = fail;
      })
  );
  const finish = jest.fn();
  const recovery = recoverAdReceipt(purchase, () => true, finish, save);
  await Promise.resolve();
  expect(finish).not.toHaveBeenCalled();
  reject(new Error('database unavailable'));
  await expect(recovery).rejects.toThrow('database unavailable');
  expect(finish).not.toHaveBeenCalled();
});
it('ignores a successful slow response after the purchasing account changes', async () => {
  let complete!: (value: any) => void;
  let current = true;
  const save = jest.fn(
    () =>
      new Promise<any>(resolve => {
        complete = resolve;
      })
  );
  const finish = jest.fn();
  const recovery = recoverAdReceipt(purchase, () => current, finish, save);
  current = false;
  complete(intent);
  await expect(recovery).rejects.toThrow('account changed');
  expect(finish).not.toHaveBeenCalled();
});
it('replays an unfinished receipt after re-login and acknowledges only after durable acceptance', async () => {
  const order: string[] = [];
  const save = jest.fn(async () => {
    order.push('durable');
    return intent;
  });
  const finish = jest.fn(async () => {
    order.push('ack');
  });
  await expect(recoverAdReceipt(purchase, () => true, finish, save)).resolves.toBe(intent);
  expect(order).toEqual(['durable', 'ack']);
  expect(save).toHaveBeenCalledWith(purchase.appAccountToken, purchase.purchaseToken);
});
it('preserves unbound legacy receipts instead of finishing an unidentified purchase', async () => {
  const save = jest.fn(),
    finish = jest.fn();
  await expect(
    recoverAdReceipt({ purchaseToken: 'legacy' }, () => true, finish, save)
  ).rejects.toThrow();
  expect(save).not.toHaveBeenCalled();
  expect(finish).not.toHaveBeenCalled();
});

it('binds a date revision to the reviewed purchase dates and validates the response', async () => {
  const saved = {
    id: purchase.appAccountToken,
    ad_id: 'test-ad',
    status: 'needs_action' as const,
    dates: ['2026-09-07'],
    last_error_code: 'BOOKING_DATES_EXPIRED',
    items: [{ sku: 'MOND_THURS' as const, quantity: 1, remaining: 0 }],
  };
  const dates = ['2026-09-14'];
  jest.mocked(httpPost).mockResolvedValueOnce({ ...saved, dates, status: 'completed' });
  await expect(reviseAdIntentDates(saved, dates)).resolves.toMatchObject({
    status: 'completed',
    dates,
  });
  expect(httpPost).toHaveBeenLastCalledWith(`/payments/apple/ad-intents/${saved.id}/dates`, {
    dates,
    expected_dates: saved.dates,
  });
  jest.mocked(httpPost).mockResolvedValueOnce({ ...saved, status: 'silently_changed_contract' });
  await expect(reviseAdIntentDates(saved, dates)).rejects.toThrow();
});
