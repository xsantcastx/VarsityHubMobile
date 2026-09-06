import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '@/context/AuthProvider';
import {
  createAdIntent,
  reconcileAdIntents,
  recoverAdReceipt,
  type AdPurchaseIntent,
} from '@/lib/adPurchaseRecovery';
import { flushPendingAdVerifications, hasPendingAdVerification } from '@/lib/adVerificationQueue';
import { captureException } from '@/utils/sentry';

export const AD_IAP_PRODUCT_IDS = { weekday: 'MOND_THURS', weekend: 'FRI_SUN' } as const;
const skus: string[] = Object.values(AD_IAP_PRODUCT_IDS);
const enabled = Platform.OS === 'ios' && Constants.executionEnvironment !== 'storeClient';
let useStore: any = () => ({ connected: false, products: [] });
let pendingTransactions: () => Promise<any[]> = async () => [];
if (enabled) {
  try {
    const store = require('react-native-iap');
    useStore = store.useIAP;
    pendingTransactions = store.getPendingTransactionsIOS;
  } catch {
    captureException(new Error('Ad StoreKit bridge unavailable'), {
      tags: { context: 'ad_iap_bridge' },
    });
  }
}
type Result = { ok: boolean; error?: string };
type Params = { adId: string; dates: string[]; weekdayBlocks: number; weekendBlocks: number };
type Checkout = {
  owner: string;
  intentId?: string;
  requested: Set<string>;
  resolve: (result: Result) => void;
  timer?: ReturnType<typeof setTimeout>;
};
type Value = {
  connected: boolean;
  products: any[];
  purchasing: boolean;
  error: string | null;
  purchaseAd: (params: Params) => Promise<Result>;
  getProduct: (type: 'weekday' | 'weekend') => any;
};
const Context = createContext<Value | null>(null);

export function AdPurchaseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const owner = user?.id;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const mounted = useRef(true);
  const active = useRef<Checkout | null>(null);
  const processing = useRef(new Map<string, Promise<AdPurchaseIntent>>());
  const recovery = useRef<Promise<void> | null>(null);
  const recoveryOwner = useRef<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finishCheckout = (checkout: Checkout, result: Result) => {
    if (active.current !== checkout) return;
    clearTimeout(checkout.timer);
    active.current = null;
    if (mounted.current) {
      setPurchasing(false);
      setError(result.error ?? null);
    }
    checkout.resolve(result);
  };
  const report = (context: string, intentId?: string) => {
    captureException(new Error('Ad purchase recovery interrupted'), {
      tags: { context },
      extra: { intent_id: intentId },
    });
  };
  const store = useStore({
    onPurchaseSuccess: (purchase: any) => {
      if (!skus.includes(purchase?.productId) || !ownerRef.current) return;
      void processPurchase(purchase, ownerRef.current).catch(() => {
        report('ad_iap_receipt_recovery', purchase?.appAccountToken);
        const checkout = active.current;
        if (checkout)
          finishCheckout(checkout, {
            ok: false,
            error:
              'Your purchase is saved by Apple. Reconnect to retry activation before purchasing again.',
          });
      });
    },
    onPurchaseError: (event: any) => {
      const checkout = active.current;
      if (!checkout) return;
      // Subscription callbacks belong to the separate subscription checkout.
      if (event?.productId && !skus.includes(event.productId)) return;
      const cancelled = /cancel/i.test(event?.code || event?.message || '');
      if (!cancelled) report('ad_iap_purchase_request', checkout.intentId);
      finishCheckout(checkout, {
        ok: false,
        error: cancelled
          ? undefined
          : 'Apple could not complete checkout. Retry to resume your saved purchase.',
      });
    },
  });
  const storeRef = useRef(store);
  storeRef.current = store;
  const next = async (intent: AdPurchaseIntent, checkout: Checkout) => {
    if (active.current !== checkout || ownerRef.current !== checkout.owner || !mounted.current)
      return;
    if (intent.status === 'completed') {
      finishCheckout(checkout, { ok: true });
      return;
    }
    if (intent.status === 'needs_action') {
      finishCheckout(checkout, {
        ok: false,
        error:
          'Your payment is saved, but these dates could not be booked. Contact support with your ad details; do not purchase again.',
      });
      return;
    }
    const item = intent.items.find(entry => entry.remaining > 0);
    if (!item) {
      finishCheckout(checkout, {
        ok: false,
        error: 'Payment received. Booking activation is being retried automatically.',
      });
      return;
    }
    if (checkout.requested.has(item.sku)) return;
    checkout.requested.add(item.sku);
    await storeRef.current.requestPurchase({
      type: 'in-app',
      request: {
        apple: {
          sku: item.sku,
          quantity: item.remaining,
          appAccountToken: intent.id,
        },
      },
    });
  };
  const processPurchase = (purchase: any, account: string): Promise<AdPurchaseIntent> => {
    const transactionId = purchase?.id ?? purchase?.transactionId;
    if (!transactionId) return Promise.reject(new Error('Missing Apple transaction identifier'));
    const key = `${account}:${transactionId}`;
    const existing = processing.current.get(key);
    if (existing) return existing;
    const operation = (async () => {
      const intent = await recoverAdReceipt(
        purchase,
        () => mounted.current && ownerRef.current === account,
        () => storeRef.current.finishTransaction({ purchase, isConsumable: true })
      );
      const checkout = active.current;
      if (checkout?.intentId === intent.id) await next(intent, checkout);
      return intent;
    })().finally(() => {
      processing.current.delete(key);
    });
    processing.current.set(key, operation);
    return operation;
  };
  const recover = async (): Promise<void> => {
    const account = ownerRef.current;
    if (!account || !enabled || !storeRef.current.connected || !mounted.current) return;
    if (recovery.current) {
      if (recoveryOwner.current === account) return recovery.current;
      // A new account must get its own recovery after the old request settles.
      // The old account's failure was reported by its original caller.
      await recovery.current.catch(() => undefined);
      if (ownerRef.current === account && mounted.current) return recover();
      return;
    }
    recoveryOwner.current = account;
    const operation = (async () => {
      const purchases = await pendingTransactions();
      let failed = false;
      for (const purchase of purchases) {
        if (ownerRef.current !== account || !mounted.current) return;
        if (!skus.includes(purchase.productId)) continue;
        // Legacy receipts lack a server intent. Preserve them for the legacy recovery queue.
        if (!purchase.appAccountToken) continue;
        try {
          await processPurchase(purchase, account);
        } catch {
          failed = true;
          report('ad_iap_pending_receipt', purchase.appAccountToken);
        }
      }
      if (ownerRef.current === account && mounted.current) await reconcileAdIntents();
      if (failed)
        throw new Error('Unfinished Apple transactions must be recovered before charging again');
    })().finally(() => {
      recovery.current = null;
      recoveryOwner.current = null;
    });
    recovery.current = operation;
    return operation;
  };
  const recoverRef = useRef(recover);
  recoverRef.current = recover;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const checkout = active.current;
      if (checkout)
        finishCheckout(checkout, {
          ok: false,
          error: 'Checkout closed. Your purchase can be resumed.',
        });
    };
  }, []);
  useEffect(() => {
    const checkout = active.current;
    if (checkout && checkout.owner !== owner)
      finishCheckout(checkout, {
        ok: false,
        error: 'Sign in to the purchasing account to resume.',
      });
    if (!owner || !store.connected || !enabled) return;
    const run = () => {
      void recoverRef.current().catch(() => report('ad_iap_reauthentication'));
    };
    run();
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') run();
    });
    const network = NetInfo.addEventListener(state => {
      if (state.isConnected) run();
    });
    return () => {
      app.remove();
      network();
    };
  }, [owner, store.connected]);
  const purchaseAd = async (params: Params): Promise<Result> => {
    if (!enabled || !owner || !storeRef.current.connected)
      return { ok: false, error: 'Sign in and connect to the App Store before purchasing.' };
    if (active.current) return { ok: false, error: 'A checkout is already in progress.' };
    return new Promise<Result>(resolve => {
      const checkout: Checkout = { owner, requested: new Set(), resolve };
      active.current = checkout;
      setPurchasing(true);
      setError(null);
      checkout.timer = setTimeout(
        () =>
          finishCheckout(checkout, {
            ok: false,
            error: 'Checkout timed out. Retry to resume your saved purchase.',
          }),
        120000
      );
      void (async () => {
        await recover();
        await flushPendingAdVerifications();
        if (await hasPendingAdVerification(params.adId))
          throw new Error('A legacy purchase needs recovery before another checkout.');
        await storeRef.current.fetchProducts({ skus, type: 'in-app' });
        if (active.current !== checkout || ownerRef.current !== owner) return;
        const intent = await createAdIntent(params.adId, params.dates);
        checkout.intentId = intent.id;
        await next(intent, checkout);
      })().catch(() => {
        report('ad_iap_checkout', checkout.intentId);
        finishCheckout(checkout, {
          ok: false,
          error: 'Checkout could not continue. Resume using the same dates as your saved purchase.',
        });
      });
    });
  };
  return (
    <Context.Provider
      value={{
        connected: !!store.connected,
        products: store.products || [],
        purchasing,
        error,
        purchaseAd,
        getProduct: type =>
          (store.products || []).find(
            (product: any) => (product.id ?? product.productId) === AD_IAP_PRODUCT_IDS[type]
          ),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAdPurchaseContext() {
  const value = useContext(Context);
  if (!value) throw new Error('AdPurchaseProvider is required');
  return value;
}
