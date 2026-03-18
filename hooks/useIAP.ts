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
let getAvailablePurchasesFn: any = async () => [];
let restorePurchasesFn: any = async () => {};
if (!isExpoGo) {
  try {
    const iap = require('react-native-iap');
    useRNIAP = iap.useIAP;
    getReceiptIOS = iap.getReceiptIOS;
    getAvailablePurchasesFn = iap.getAvailablePurchases;
    restorePurchasesFn = iap.restorePurchases;
  } catch {
    // react-native-iap not available
  }
}
type Purchase = any;
type PurchaseError = any;

const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// IAP product IDs — must match App Store Connect / Google Play Console exactly (use lowercase)
export const IAP_PRODUCT_IDS = {
  veteran: 'veteran_vhub',
  legend: 'legend_vhub',
} as const;

// Aliases for resilience across historical casing (App Store Connect may use Legend_vhub)
const PLAN_SKUS: Record<'veteran' | 'legend', string[]> = {
  veteran: [IAP_PRODUCT_IDS.veteran],
  legend: [IAP_PRODUCT_IDS.legend, 'Legend_vhub'],
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
        } catch (finishErr) {
          if (__DEV__) console.warn('[useVHubIAP] finishTransaction failed:', (finishErr as Error)?.message);
        }
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
    if (isExpoGo) {
      if (__DEV__) console.warn('[useVHubIAP] IAP disabled in Expo Go — use EAS build to test');
      return;
    }
    if (!isIOS && !isAndroid) return;
    if (!connected) {
      if (__DEV__) console.warn('[useVHubIAP] Store not connected yet — IAP will not work until connected. Use EAS build (not Expo Go).');
      return;
    }
    fetchProducts({ skus: ALL_SKUS, type: 'subs' }).catch((err: unknown) => {
      if (__DEV__) console.warn('[useVHubIAP] fetchProducts failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscription products');
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
      const availableSku = subscriptions.find((p: { productId?: string }) => planSkus.includes(p.productId ?? '')) as { productId?: string } | undefined;
      if (__DEV__ && !availableSku) {
        console.warn('[useVHubIAP] Plan SKU not in store response:', { plan, planSkus, subscriptionIds: subscriptions.map((s: { productId?: string }) => s.productId) });
      }
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
      return subscriptions.find((p: { productId?: string }) => planSkus.includes(p.productId ?? ''));
    },
    [subscriptions]
  );

  const restore = useCallback(async (): Promise<boolean> => {
    if (isExpoGo || (!isIOS && !isAndroid)) return false;
    setPurchasing(true);
    setError(null);
    try {
      await restorePurchasesFn();
      const purchases = await getAvailablePurchasesFn({ onlyIncludeActiveItemsIOS: true });
      const subs = Array.isArray(purchases) ? purchases : [];
      const ourSubs = subs.filter((p: { productId?: string }) =>
        PLAN_SKUS.veteran.includes(p.productId ?? '') || PLAN_SKUS.legend.includes(p.productId ?? '')
      );
      for (const p of ourSubs) {
        try {
          if (isIOS) {
            let receipt: string | undefined;
            try { receipt = await getReceiptIOS(); } catch { receipt = (p as any).transactionReceipt; }
            if (receipt) {
              await httpPost('/payments/apple/verify-receipt', { receipt, productId: p.productId });
            }
          } else if (isAndroid) {
            const token = (p as any).purchaseToken;
            if (token) {
              await httpPost('/payments/google/verify-purchase', {
                purchase_token: token,
                product_id: p.productId,
                package_name: (p as any).packageNameAndroid || 'com.varsityhub.varsityhub',
              });
            }
          }
        } catch (e) {
          if (__DEV__) console.warn('[useVHubIAP] Restore verify failed for', p.productId, e);
        }
      }
      setPurchasing(false);
      return ourSubs.length > 0;
    } catch (err: unknown) {
      if (__DEV__) console.warn('[useVHubIAP] restorePurchases failed:', err);
      setError(err instanceof Error ? err.message : 'Restore failed');
      setPurchasing(false);
      return false;
    }
  }, []);

  return {
    connected,
    products: subscriptions,
    purchasing,
    error,
    purchase,
    getProduct,
    restore,
  };
}
