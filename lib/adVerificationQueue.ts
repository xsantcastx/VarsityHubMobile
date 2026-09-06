import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpPost } from '@/api/http';
import { captureException } from '@/utils/sentry';

const PENDING_AD_IAP_KEY = 'vh_pending_ad_iap_receipt_verifications_v1';

export type PendingAdVerification = {
  id: string;
  adId: string;
  dates: string[];
  receipts: { jws?: string | null; receipt?: string; productId: string; quantity: number }[];
  ready?: boolean;
  attemptCount: number;
  createdAt: number;
};

let flushQueuePromise: Promise<void> | null = null;
let queueMutation: Promise<unknown> = Promise.resolve();
function mutateQueue(fn: (items: PendingAdVerification[]) => PendingAdVerification[]) {
  const operation = queueMutation.then(async () => {
    const items = await readPendingAdVerifications();
    await writePendingAdVerifications(fn(items));
  });
  queueMutation = operation.catch(() => {});
  return operation;
}

async function readPendingAdVerifications(): Promise<PendingAdVerification[]> {
  const raw = await AsyncStorage.getItem(PENDING_AD_IAP_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      item =>
        !item ||
        typeof item.id !== 'string' ||
        typeof item.adId !== 'string' ||
        !Array.isArray(item.dates) ||
        !Array.isArray(item.receipts)
    )
  ) {
    throw new Error(
      'Stored ad receipts could not be read; contact support before purchasing again'
    );
  }
  return parsed;
}

async function writePendingAdVerifications(items: PendingAdVerification[]) {
  if (items.length === 0) {
    await AsyncStorage.removeItem(PENDING_AD_IAP_KEY);
    return;
  }
  await AsyncStorage.setItem(PENDING_AD_IAP_KEY, JSON.stringify(items));
}

export async function enqueuePendingAdVerification(item: PendingAdVerification) {
  await mutateQueue(existing => [...existing.filter(entry => entry.id !== item.id), item]);
}

export async function submitAdVerification(item: PendingAdVerification) {
  await httpPost('/payments/apple/verify-ad-receipt', {
    ad_id: item.adId,
    dates: item.dates,
    receipts: item.receipts,
  });
}

export function getVerificationErrorMessage(err: any) {
  return err?.message || err?.data?.error || 'Receipt verification is taking longer than usual';
}

export async function flushPendingAdVerifications(onError?: (message: string) => void) {
  if (flushQueuePromise) return flushQueuePromise;

  flushQueuePromise = (async () => {
    const queue = await readPendingAdVerifications();
    if (queue.length === 0) return;

    for (const item of queue) {
      if (item.ready === false) {
        onError?.(
          'An incomplete ad purchase needs recovery. Contact support before purchasing again.'
        );
        continue;
      }
      try {
        await submitAdVerification(item);
        await mutateQueue(current => current.filter(entry => entry.id !== item.id));
      } catch (err: any) {
        const message = getVerificationErrorMessage(err);
        onError?.(message);
        await mutateQueue(current =>
          current.map(entry =>
            entry.id === item.id ? { ...entry, attemptCount: entry.attemptCount + 1 } : entry
          )
        );
        if (__DEV__) console.error('[useAdIAP] background verify-ad-receipt error:', err);
      }
    }
  })()
    .catch(err => {
      onError?.(getVerificationErrorMessage(err));
      captureException(new Error('Ad recovery storage failed'), {
        tags: { context: 'ad_receipt_recovery' },
      });
    })
    .finally(() => {
      flushQueuePromise = null;
    });

  return flushQueuePromise;
}

export function removePendingAdVerification(id: string) {
  return mutateQueue(current => current.filter(entry => entry.id !== id));
}

export async function hasPendingAdVerification(adId: string) {
  await queueMutation;
  return (await readPendingAdVerifications()).some(item => item.adId === adId);
}
