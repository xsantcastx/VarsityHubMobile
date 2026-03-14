/**
 * useVHubIAP — Wraps react-native-iap's useIAP hook for VarsityHub subscriptions.
 *
 * Handles product fetching, purchasing, and server-side receipt validation
 * for veteran_vhub and Legend_vhub IAP products on iOS and Android.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { httpPost } from '@/api/http';

// Only import react-native-iap in standalone builds (not Expo Go)
const isExpoGo = Constants.executionEnvironment === 'storeClient';
let useRNIAP: any = () => ({});
let getReceiptIOS: any = async () => '';
if (!isExpoGo) {
  try {
    const iap = require('react-native-iap');
    useRNIAP = iap.useIAP;
    getReceiptIOS = iap.getReceiptIOS;
  } catch {
    // react-native-iap not available
  }
}
type Purchase = any;
type PurchaseError = any;

const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// IAP product IDs — must match App Store Connect / Google Play Console exactly
export const IAP_PRODUCT_IDS = {
  veteran: 'veteran_vhub',
  legend: 'Legend_vhub',
} as const;

// Keep aliases for resilience across historical casing differences.
const PLAN_SKUS: Record<'veteran' | 'legend', string[]> = {
  veteran: [IAP_PRODUCT_IDS.veteran],
  legend: [IAP_PRODUCT_IDS.legend, 'legend_vhub'],
};
const ALL_SKUS = Array.from(new Set([...PLAN_SKUS.veteran, ...PLAN_SKUS.legend]));

export function useVHubIAP() {
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const purchaseResolveRef = useRef<((success: boolean) => void) | null>(null);

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useRNIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      try {
        if (isIOS) {
          // iOS: Get receipt and verify with Apple endpoint
          let receipt: string | undefined;
          try {
            receipt = await getReceiptIOS();
          } catch {
            receipt = (purchase as any).transactionReceipt;
          }

          if (!receipt) {
            throw new Error('No receipt available for validation');
          }

          await httpPost('/payments/apple/verify-receipt', {
            receipt,
            productId: purchase.productId,
          });
        } else if (isAndroid) {
          // Android: Send purchaseToken to Google verification endpoint
          const purchaseToken = (purchase as any).purchaseToken;
          if (!purchaseToken) {
            throw new Error('No purchase token available for validation');
          }

          await httpPost('/payments/google/verify-purchase', {
            purchase_token: purchaseToken,
            product_id: purchase.productId,
            package_name: (purchase as any).packageNameAndroid || 'com.varsityhub.varsityhub',
          });
        }

        // Acknowledge the transaction with the store
        await finishTransaction({ purchase, isConsumable: false });

        setPurchasing(false);
        setError(null);
        purchaseResolveRef.current?.(true);
        purchaseResolveRef.current = null;
      } catch (err: any) {
        if (__DEV__) console.error('[useVHubIAP] receipt validation error:', err);
        try {
          await finishTransaction({ purchase, isConsumable: false });
        } catch {}
        setPurchasing(false);
        setError(err?.message || 'Receipt validation failed');
        purchaseResolveRef.current?.(false);
        purchaseResolveRef.current = null;
      }
    },
    onPurchaseError: (err: PurchaseError) => {
      const msg = err?.message || '';
      // User cancelled — not an error
      if (msg.toLowerCase().includes('cancel') || (err as any)?.code === 'E_USER_CANCELLED') {
        setPurchasing(false);
        setError(null);
        purchaseResolveRef.current?.(false);
        purchaseResolveRef.current = null;
        return;
      }
      if (__DEV__) console.warn('[useVHubIAP] purchase error:', err);
      setPurchasing(false);
      setError(msg || 'Purchase failed');
      purchaseResolveRef.current?.(false);
      purchaseResolveRef.current = null;
    },
  });

  // Fetch subscription products on mount (iOS and Android)
  useEffect(() => {
    if (!connected || (!isIOS && !isAndroid)) return;
    fetchProducts({ skus: ALL_SKUS, type: 'subs' }).catch((err) => {
      if (__DEV__) console.warn('[useVHubIAP] fetchProducts error:', err);
    });
  }, [connected, fetchProducts]);

  const purchase = useCallback(
    async (plan: 'veteran' | 'legend'): Promise<boolean> => {
      const planSkus = PLAN_SKUS[plan];
      if (!planSkus || planSkus.length === 0) {
        setError(`Unknown plan: ${plan}`);
        return false;
      }
      // Prefer the SKU currently returned from the store, fall back to primary configured SKU.
      const availableSku = subscriptions.find((p) => planSkus.includes((p as any).productId)) as any;
      const sku = availableSku?.productId || planSkus[0];

      setPurchasing(true);
      setError(null);

      return new Promise<boolean>((resolve) => {
        purchaseResolveRef.current = resolve;

        // Platform-specific purchase request
        const purchaseRequest = isAndroid
          ? { type: 'subs' as const, request: { google: { skus: [sku] } } }
          : { type: 'subs' as const, request: { apple: { sku } } };

        requestPurchase(purchaseRequest).catch((err: any) => {
          const msg = err?.message || '';
          if (msg.toLowerCase().includes('cancel')) {
            setPurchasing(false);
            setError(null);
            resolve(false);
            return;
          }
          if (__DEV__) console.error('[useVHubIAP] requestPurchase error:', err);
          setPurchasing(false);
          setError(msg || 'Purchase request failed');
          resolve(false);
        });
      });
    },
    [requestPurchase]
  );

  const getProduct = useCallback(
    (plan: 'veteran' | 'legend') => {
      const planSkus = PLAN_SKUS[plan];
      return subscriptions.find((p) => planSkus.includes((p as any).productId));
    },
    [subscriptions]
  );

  return {
    connected,
    products: subscriptions,
    purchasing,
    error,
    purchase,
    getProduct,
  };
}
