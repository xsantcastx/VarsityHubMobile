import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpPost } from '@/api/http';
import {
  enqueuePendingAdVerification,
  flushPendingAdVerifications,
} from '@/lib/adVerificationQueue';
jest.mock('@/api/http', () => ({ httpPost: jest.fn() }));
jest.mock('@/utils/sentry', () => ({ captureException: jest.fn() }));
const item = (id: string, ready = true) => ({
  id,
  adId: id,
  dates: [],
  receipts: [],
  attemptCount: 0,
  createdAt: Date.now(),
  ready,
});
const key = 'vh_pending_ad_iap_receipt_verifications_v1';
describe('durable ad receipt queue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.mocked(httpPost).mockReset();
  });
  it('preserves a receipt enqueued while another receipt is submitting', async () => {
    let release!: () => void;
    let started!: () => void;
    const entered = new Promise<void>(resolve => {
      started = resolve;
    });
    jest.mocked(httpPost).mockImplementationOnce(async () => {
      started();
      await new Promise<void>(resolve => {
        release = resolve;
      });
      return {};
    });
    await enqueuePendingAdVerification(item('A'));
    const flush = flushPendingAdVerifications();
    await entered;
    await enqueuePendingAdVerification(item('B'));
    release();
    await flush;
    expect(JSON.parse((await AsyncStorage.getItem(key))!)).toEqual(
      [item('B')].map(x => ({ ...x, createdAt: expect.any(Number) }))
    );
    expect(httpPost).toHaveBeenCalledTimes(1);
  });
  it('serializes simultaneous enqueues', async () => {
    await Promise.all([
      enqueuePendingAdVerification(item('A')),
      enqueuePendingAdVerification(item('B')),
    ]);
    expect(JSON.parse((await AsyncStorage.getItem(key))!).map((x: any) => x.id)).toEqual([
      'A',
      'B',
    ]);
  });
  it('does not submit partial bundles or discard old receipts', async () => {
    await enqueuePendingAdVerification({ ...item('partial', false), createdAt: 1 });
    await flushPendingAdVerifications();
    expect(httpPost).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(key)).toContain('partial');
  });
  it('rejects failed persistence', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(enqueuePendingAdVerification(item('A'))).rejects.toThrow('disk full');
  });
  it('preserves corrupt storage and reports the recovery error', async () => {
    await AsyncStorage.setItem(key, '{broken');
    const report = jest.fn();
    await flushPendingAdVerifications(report);
    expect(report).toHaveBeenCalled();
    expect(await AsyncStorage.getItem(key)).toBe('{broken');
  });
});
