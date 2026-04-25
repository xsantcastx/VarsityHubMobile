/**
 * useVHubIAP — Wraps react-native-iap's useIAP hook for VarsityHub subscriptions.
 *
 * Handles product fetching, purchasing, and server-side receipt validation
 * for MIDTIER and TOPTIER IAP products on iOS and Android.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { httpPost } from '@/api/http';
import { captureBreadcrumb } from '@/utils/sentry';

// Only import react-native-iap in standalone builds (not Expo Go)
const isExpoGo = Constants.executionEnvironment === 'storeClient';
const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';
let useRNIAP: any = () => ({});
let getReceiptIOS: any = async () => '';
let getAvailablePurchasesFn: any = async () => [];
let restorePurchasesFn: any = async () => {};
if (!isExpoGo && isNativeMobile) {
  try {
    if (Platform.OS !== 'web') {
      const iap = require('react-native-iap');
      useRNIAP = iap.useIAP;
      getReceiptIOS = iap.getReceiptIOS;
      getAvailablePurchasesFn = iap.getAvailablePurchases;
      restorePurchasesFn = iap.restorePurchases;
    }
  } catch {
    // react-native-iap not available
  }
}
type Purchase = any;
type PurchaseError = any;

const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// IAP product IDs — must match App Store Connect / Google Play Console exactly.
export const IAP_PRODUCT_IDS = {
  veteran: 'MIDTIER',
  legend: 'TOPTIER',
} as const;

// Aliases for resilience across historical casing
const PLAN_SKUS: Record<'veteran' | 'legend', string[]> = {
  veteran: [IAP_PRODUCT_IDS.veteran],
  legend: [IAP_PRODUCT_IDS.legend],
};
const ALL_SKUS = Array.from(new Set([...PLAN_SKUS.veteran, ...PLAN_SKUS.legend]));

export function useVHubIAP() {
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const purchaseResolveRef = useRef<((success: boolean) => void) | null>(null);
  const lastPendingRecoveryAtRef = useRef(0);

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useRNIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      captureBreadcrumb('Subscription store purchase received', 'payments.subscription', {
        platform: isIOS ? 'ios' : isAndroid ? 'android' : Platform.OS,
        product_id: purchase?.productId,
      });
      try {
        if (isIOS) {
          const jws = (purchase as any).purchaseToken || null;
          let receipt: string | undefined;
          if (!jws) {
            try {
              receipt = await getReceiptIOS();
              captureBreadcrumb('Apple receipt fetched', 'payments.subscription', {
                source: 'getReceiptIOS',
                product_id: purchase?.productId,
              });
            } catch {
              receipt = (purchase as any).transactionReceipt;
              captureBreadcrumb('Apple receipt fallback used', 'payments.subscription', {
                source: 'transactionReceipt',
                product_id: purchase?.productId,
              }, 'warning');
            }
          }
          if (!jws && !receipt) throw new Error('No receipt available for validation');

          captureBreadcrumb('Subscription receipt verification started', 'payments.subscription', {
            provider: 'apple',
            product_id: purchase?.productId,
          });
          await httpPost('/payments/apple/verify-receipt', {
            jws,
            receipt,
            productId: purchase.productId,
          });
        } else if (isAndroid) {
          // Android: Send purchaseToken to Google verification endpoint
          const purchaseToken = (purchase as any).purchaseToken;
          if (!purchaseToken) {
            throw new Error('No purchase token available for validation');
          }

          captureBreadcrumb('Subscription receipt verification started', 'payments.subscription', {
            provider: 'google',
            product_id: purchase?.productId,
          });
          await httpPost('/payments/google/verify-purchase', {
            purchase_token: purchaseToken,
            product_id: purchase.productId,
            package_name: (purchase as any).packageNameAndroid || 'com.varsityhub.varsityhub',
          });
        }

        // Acknowledge the transaction with the store
        captureBreadcrumb('Subscription receipt verification succeeded', 'payments.subscription', {
          product_id: purchase?.productId,
        });
        captureBreadcrumb('Subscription store transaction finish started', 'payments.subscription', {
          product_id: purchase?.productId,
        });
        await finishTransaction({ purchase, isConsumable: false });
        captureBreadcrumb('Subscription store transaction finished', 'payments.subscription', {
          product_id: purchase?.productId,
        });

        setPurchasing(false);
        setError(null);
        purchaseResolveRef.current?.(true);
        purchaseResolveRef.current = null;
      } catch (err: any) {
        if (__DEV__) console.error('[useVHubIAP] receipt validation error:', err);
        captureBreadcrumb('Subscription purchase processing failed', 'payments.subscription', {
          product_id: purchase?.productId,
          error: err?.message || 'unknown_error',
        }, 'error');
        try {
          await finishTransaction({ purchase, isConsumable: false });
          captureBreadcrumb('Subscription store transaction finished after error', 'payments.subscription', {
            product_id: purchase?.productId,
          }, 'warning');
        } catch (finishErr) {
          if (__DEV__) console.warn('[useVHubIAP] finishTransaction failed:', (finishErr as Error)?.message);
          captureBreadcrumb('Subscription store transaction finish failed', 'payments.subscription', {
            product_id: purchase?.productId,
            error: (finishErr as Error)?.message || 'unknown_error',
          }, 'error');
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
        captureBreadcrumb('Subscription purchase cancelled', 'payments.subscription', {
          code: (err as any)?.code,
        }, 'info');
        setPurchasing(false);
        setError(null);
        purchaseResolveRef.current?.(false);
        purchaseResolveRef.current = null;
        return;
      }
      if (__DEV__) console.warn('[useVHubIAP] purchase error:', err);
      captureBreadcrumb('Subscription purchase failed', 'payments.subscription', {
        code: (err as any)?.code,
        error: msg || 'unknown_error',
      }, 'error');
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
      captureBreadcrumb('Subscription products load failed', 'payments.subscription', {
        error: err instanceof Error ? err.message : 'unknown_error',
      }, 'warning');
      setError(err instanceof Error ? err.message : 'Failed to load subscription products');
    });
  }, [connected, fetchProducts]);

  const recoverPendingPurchases = useCallback(async () => {
    if (isExpoGo || (!isIOS && !isAndroid) || !connected) return;
    const now = Date.now();
    if (now - lastPendingRecoveryAtRef.current < 10000) return;
    lastPendingRecoveryAtRef.current = now;

    try {
      captureBreadcrumb('Subscription pending purchase recovery started', 'payments.subscription', {
        platform: isIOS ? 'ios' : isAndroid ? 'android' : Platform.OS,
      });
      const purchases = await getAvailablePurchasesFn({ onlyIncludeActiveItemsIOS: true });
      const pending = Array.isArray(purchases)
        ? purchases.filter(
            (p: any) =>
              PLAN_SKUS.veteran.includes(p.productId ?? '') ||
              PLAN_SKUS.legend.includes(p.productId ?? '')
          )
        : [];
      for (const p of pending) {
        try {
          if (isIOS) {
            const jws = (p as any).purchaseToken || null;
            let receipt: string | undefined;
            if (!jws) {
              try {
                receipt = await getReceiptIOS();
              } catch {
                receipt = (p as any).transactionReceipt;
              }
            }
            await httpPost('/payments/apple/verify-receipt', { jws, receipt, productId: p.productId });
          } else if (isAndroid && (p as any).purchaseToken) {
            await httpPost('/payments/google/verify-purchase', {
              purchase_token: (p as any).purchaseToken,
              product_id: p.productId,
              package_name: (p as any).packageNameAndroid || 'com.varsityhub.varsityhub',
            });
          }
          await finishTransaction({ purchase: p, isConsumable: false }).catch(() => {});
        } catch (e) {
          if (__DEV__)
            console.warn('[useVHubIAP] Pending purchase recovery failed for', p.productId, e);
          captureBreadcrumb('Subscription pending purchase recovery failed', 'payments.subscription', {
            product_id: p?.productId,
            error: e instanceof Error ? e.message : 'unknown_error',
          }, 'warning');
        }
      }
      captureBreadcrumb('Subscription pending purchase recovery completed', 'payments.subscription', {
        recovered_count: pending.length,
      });
      if (pending.length && __DEV__) {
        console.log(`[useVHubIAP] Recovered ${pending.length} pending purchase(s)`);
      }
    } catch (err) {
      if (__DEV__) console.warn('[useVHubIAP] Pending purchase scan failed:', err);
      captureBreadcrumb('Subscription pending purchase scan failed', 'payments.subscription', {
        error: err instanceof Error ? err.message : 'unknown_error',
      }, 'warning');
    }
  }, [connected, finishTransaction]);

  // Recover pending/unacknowledged purchases on startup (prevents stuck purchases after crash)
  useEffect(() => {
    void recoverPendingPurchases();
  }, [recoverPendingPurchases]);

  // Retry pending purchase recovery when the app returns to foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void recoverPendingPurchases();
      }
    });
    return () => subscription.remove();
  }, [recoverPendingPurchases]);

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
            const jws = (p as any).purchaseToken || null;
            let receipt: string | undefined;
            if (!jws) {
              try { receipt = await getReceiptIOS(); } catch { receipt = (p as any).transactionReceipt; }
            }
            await httpPost('/payments/apple/verify-receipt', { jws, receipt, productId: p.productId });
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
