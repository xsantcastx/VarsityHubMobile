/**
 * useVHubIAP — Wraps react-native-iap's useIAP hook for VarsityHub subscriptions.
 *
 * Handles product fetching, purchasing, and server-side receipt validation
 * for veteran_vhub and Legend_vhub IAP products on iOS.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { Platform } from 'react-native';
import {
  useIAP as useRNIAP,
  getReceiptIOS,
} from 'react-native-iap';
import type { Purchase, PurchaseError } from 'react-native-iap';
import { httpPost } from '@/api/http';

// Apple IAP product IDs — must match App Store Connect exactly
export const IAP_PRODUCT_IDS = {
  veteran: 'veteran_vhub',
  legend: 'Legend_vhub',
} as const;

const ALL_SKUS = [IAP_PRODUCT_IDS.veteran, IAP_PRODUCT_IDS.legend];

export function useVHubIAP() {
  const isIOS = Platform.OS === 'ios';
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
        // Get the receipt for server validation
        let receipt: string | undefined;
        try {
          receipt = await getReceiptIOS();
        } catch {
          receipt = (purchase as any).transactionReceipt;
        }

        if (receipt) {
          await httpPost('/payments/apple/verify-receipt', {
            receipt,
            productId: purchase.productId,
          });
        }

        // Acknowledge the transaction with Apple
        await finishTransaction({ purchase, isConsumable: false });

        setPurchasing(false);
        setError(null);
        purchaseResolveRef.current?.(true);
        purchaseResolveRef.current = null;
      } catch (err: any) {
        console.error('[useVHubIAP] receipt validation error:', err);
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
      console.warn('[useVHubIAP] purchase error:', err);
      setPurchasing(false);
      setError(msg || 'Purchase failed');
      purchaseResolveRef.current?.(false);
      purchaseResolveRef.current = null;
    },
  });

  // Fetch subscription products on mount
  useEffect(() => {
    if (!isIOS || !connected) return;
    fetchProducts({ skus: ALL_SKUS, type: 'subs' }).catch((err) => {
      console.warn('[useVHubIAP] fetchProducts error:', err);
    });
  }, [isIOS, connected, fetchProducts]);

  const purchase = useCallback(
    async (plan: 'veteran' | 'legend'): Promise<boolean> => {
      const sku = IAP_PRODUCT_IDS[plan];
      if (!sku) {
        setError(`Unknown plan: ${plan}`);
        return false;
      }

      setPurchasing(true);
      setError(null);

      return new Promise<boolean>((resolve) => {
        purchaseResolveRef.current = resolve;
        requestPurchase({ type: 'subs', request: { apple: { sku } } }).catch((err: any) => {
          const msg = err?.message || '';
          if (msg.toLowerCase().includes('cancel')) {
            setPurchasing(false);
            setError(null);
            resolve(false);
            return;
          }
          console.error('[useVHubIAP] requestPurchase error:', err);
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
      const sku = IAP_PRODUCT_IDS[plan];
      return subscriptions.find((p) => (p as any).productId === sku);
    },
    [subscriptions]
  );

  return {
    connected: isIOS ? connected : false,
    products: subscriptions,
    purchasing,
    error,
    purchase,
    getProduct,
  };
}
