/**
 * useAdIAP — IAP for ad hosting (ad_weekday_vhub, ad_weekend_vhub).
 * iOS: Apple IAP. Android: Stripe fallback.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { httpPost } from '@/api/http';

const isExpoGo = Constants.executionEnvironment === 'storeClient';
let useRNIAP: any = () => ({});
let getReceiptIOS: any = async () => '';
let requestPurchase: any = async () => {};
let finishTransaction: any = async () => {};
if (!isExpoGo) {
  try {
    const iap = require('react-native-iap');
    useRNIAP = iap.useIAP;
    getReceiptIOS = iap.getReceiptIOS;
    requestPurchase = iap.requestPurchase;
    finishTransaction = iap.finishTransaction;
  } catch {}
}

const isIOS = Platform.OS === 'ios';

export const AD_IAP_PRODUCT_IDS = {
  weekday: 'ad_weekday_vhub',
  weekend: 'ad_weekend_vhub',
} as const;

const AD_SKUS = [AD_IAP_PRODUCT_IDS.weekday, AD_IAP_PRODUCT_IDS.weekend];

type PendingAd = {
  adId: string;
  dates: string[];
  receipts: { receipt: string; productId: string; quantity: number }[];
  weekdayBlocks: number;
  weekendBlocks: number;
  resolve: (result: { ok: boolean; error?: string }) => void;
};

const pendingAdRef = { current: null as PendingAd | null };

export function useAdIAP() {
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    connected,
    products,
    fetchProducts,
    requestPurchase: rnRequestPurchase,
    finishTransaction: rnFinishTransaction,
  } = useRNIAP({
    onPurchaseSuccess: async (purchase: any) => {
      const pending = pendingAdRef.current;
      if (!pending || !isIOS) return;
      const pid = purchase?.productId;
      if (pid !== AD_IAP_PRODUCT_IDS.weekday && pid !== AD_IAP_PRODUCT_IDS.weekend) return;

      try {
        let receipt: string | undefined;
        try {
          receipt = await getReceiptIOS();
        } catch {
          receipt = (purchase as any).transactionReceipt;
        }
        if (receipt) {
          pending.receipts.push({
            receipt,
            productId: pid,
            quantity: (purchase as any).quantity ?? 1,
          });
        }
        await rnFinishTransaction({ purchase, isConsumable: true });
      } catch {}

      const { weekdayBlocks, weekendBlocks } = pending;
      const hasWeekday = pending.receipts.some((r) => r.productId === AD_IAP_PRODUCT_IDS.weekday);
      const hasWeekend = pending.receipts.some((r) => r.productId === AD_IAP_PRODUCT_IDS.weekend);
      const needWeekday = weekdayBlocks > 0;
      const needWeekend = weekendBlocks > 0;
      const complete = (needWeekday ? hasWeekday : true) && (needWeekend ? hasWeekend : true);

      if (complete) {
        pendingAdRef.current = null;
        setPurchasing(false);
        try {
          const res = await httpPost('/payments/apple/verify-ad-receipt', {
            ad_id: pending.adId,
            dates: pending.dates,
            receipts: pending.receipts,
          });
          pending.resolve({ ok: !!res?.ok });
        } catch (err: any) {
          if (__DEV__) console.error('[useAdIAP] verify-ad-receipt error:', err);
          const msg = err?.message || 'Verification failed';
          setError(msg);
          pending.resolve({ ok: false, error: msg });
        }
      } else if (needWeekend && !hasWeekend) {
        rnRequestPurchase({
          type: 'in-app',
          request: { apple: { sku: AD_IAP_PRODUCT_IDS.weekend, quantity: weekendBlocks } },
        }).catch(() => {});
      }
    },
    onPurchaseError: (err: any) => {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('cancel') || err?.code === 'E_USER_CANCELLED') {
        const p = pendingAdRef.current;
        if (p) {
          pendingAdRef.current = null;
          p.resolve({ ok: false });
        }
        setPurchasing(false);
        setError(null);
        return;
      }
      if (__DEV__) console.warn('[useAdIAP] purchase error:', err);
      const errMsg = msg || 'Purchase failed';
      const p = pendingAdRef.current;
      if (p) {
        pendingAdRef.current = null;
        p.resolve({ ok: false, error: errMsg });
      }
      setPurchasing(false);
      setError(errMsg);
    },
  });

  useEffect(() => {
    if (isExpoGo || !isIOS) return;
    if (!connected) return;
    fetchProducts({ skus: AD_SKUS, type: 'in-app' }).catch((err: unknown) => {
      if (__DEV__) console.warn('[useAdIAP] fetchProducts failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ad products');
    });
  }, [connected, fetchProducts]);

  const purchaseAd = useCallback(
    async (params: {
      adId: string;
      dates: string[];
      weekdayBlocks: number;
      weekendBlocks: number;
    }): Promise<{ ok: boolean; error?: string }> => {
      const { adId, dates, weekdayBlocks, weekendBlocks } = params;
      if ((weekdayBlocks <= 0 && weekendBlocks <= 0) || !isIOS) return { ok: false };

      setPurchasing(true);
      setError(null);

      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        pendingAdRef.current = {
          adId,
          dates,
          receipts: [],
          weekdayBlocks,
          weekendBlocks,
          resolve: (result) => {
            setPurchasing(false);
            resolve(result);
          },
        };

        const run = async () => {
          try {
            if (weekdayBlocks > 0) {
              await rnRequestPurchase({
                type: 'in-app',
                request: { apple: { sku: AD_IAP_PRODUCT_IDS.weekday, quantity: weekdayBlocks } },
              });
            } else if (weekendBlocks > 0) {
              await rnRequestPurchase({
                type: 'in-app',
                request: { apple: { sku: AD_IAP_PRODUCT_IDS.weekend, quantity: weekendBlocks } },
              });
            }
          } catch (err: any) {
            if (__DEV__) console.error('[useAdIAP] requestPurchase error:', err);
            const errMsg = err?.message || 'Purchase failed';
            const p = pendingAdRef.current;
            if (p) {
              pendingAdRef.current = null;
              p.resolve({ ok: false, error: errMsg });
            }
            setPurchasing(false);
            setError(errMsg);
            resolve({ ok: false, error: errMsg });
          }
        };
        run();
      });
    },
    [rnRequestPurchase]
  );

  const getProduct = useCallback(
    (type: 'weekday' | 'weekend') => {
      const sku = type === 'weekday' ? AD_IAP_PRODUCT_IDS.weekday : AD_IAP_PRODUCT_IDS.weekend;
      return (products || []).find((p: any) => p.productId === sku);
    },
    [products]
  );

  return { connected, products: products || [], purchasing, error, purchaseAd, getProduct };
}
