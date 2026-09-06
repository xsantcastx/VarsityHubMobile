import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureException } from '@/utils/sentry';
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
    jest.mocked(captureException).mockClear();
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

describe('receipt recovery failure safeguards', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.mocked(httpPost).mockReset();
    jest.mocked(captureException).mockClear();
  });
  it('records a failed verification even without a mounted error callback', async () => {
    await enqueuePendingAdVerification(item('recover-A'));
    jest
      .mocked(httpPost)
      .mockRejectedValueOnce(Object.assign(new Error('secret-provider-payload'), { status: 502 }));
    await flushPendingAdVerifications();
    expect(JSON.parse((await AsyncStorage.getItem(key))!)[0].attemptCount).toBe(1);
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        fingerprint: ['ad_receipt_recovery', 'verify'],
        tags: expect.objectContaining({ context: 'ad_receipt_recovery', stage: 'verify' }),
        extra: expect.objectContaining({
          recovery_id: 'recover-A',
          ad_id: 'recover-A',
          attempt_count: 1,
          http_status: 502,
        }),
      })
    );
    expect(JSON.stringify(jest.mocked(captureException).mock.calls)).not.toContain(
      'secret-provider-payload'
    );
  });
  it('reports failure to remove a server-accepted receipt and safely retries it', async () => {
    await enqueuePendingAdVerification(item('accepted'));
    jest.mocked(httpPost).mockResolvedValue({});
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('disk unavailable'));
    await flushPendingAdVerifications();
    expect(await AsyncStorage.getItem(key)).toContain('accepted');
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        fingerprint: ['ad_receipt_recovery', 'ack_cleanup'],
        tags: expect.objectContaining({ stage: 'ack_cleanup' }),
      })
    );
    await flushPendingAdVerifications();
    expect(await AsyncStorage.getItem(key)).toBeNull();
    expect(httpPost).toHaveBeenCalledTimes(2);
  });
  it('makes a retained incomplete bundle observable without submitting it', async () => {
    await enqueuePendingAdVerification(item('partial', false));
    await flushPendingAdVerifications();
    expect(httpPost).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        fingerprint: ['ad_receipt_recovery', 'incomplete_bundle'],
        extra: expect.objectContaining({ recovery_id: 'partial' }),
      })
    );
  });
  it('coalesces five overlapping flushes while server verification is delayed', async () => {
    let finish!: () => void;
    const latency = new Promise<void>(resolve => {
      finish = resolve;
    });
    await enqueuePendingAdVerification(item('one'));
    jest.mocked(httpPost).mockImplementation(async () => {
      await latency;
      return {};
    });
    const runs = Array.from({ length: 5 }, () => flushPendingAdVerifications());
    finish();
    await Promise.all(runs);
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(key)).toBeNull();
  });
});
