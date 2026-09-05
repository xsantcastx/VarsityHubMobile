import React from 'react';

type PaymentSheetResult = {
  error?: {
    code?: string;
    message?: string;
  };
};

const unavailableResult = (message: string): PaymentSheetResult => ({
  error: {
    code: 'Unavailable',
    message,
  },
});

let StripeProviderImpl: React.ComponentType<any> = ({ children }) => <>{children}</>;
let initStripeImpl: ((params: { publishableKey: string }) => Promise<void>) | undefined;
let usePaymentSheetImpl: any = () => ({
  initPaymentSheet: async () =>
    unavailableResult('Stripe PaymentSheet is unavailable (native module failed to load).'),
  presentPaymentSheet: async () =>
    unavailableResult('Stripe PaymentSheet is unavailable (native module failed to load).'),
});

try {
  const stripe = require('@stripe/stripe-react-native');
  StripeProviderImpl = stripe.StripeProvider;
  usePaymentSheetImpl = stripe.usePaymentSheet;
  if (typeof stripe.initStripe === 'function') {
    initStripeImpl = params => stripe.initStripe(params);
  }
} catch (error) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[stripe] native Stripe module unavailable:', (error as Error)?.message);
  }
}

export const StripeProvider = StripeProviderImpl;
export const usePaymentSheet = usePaymentSheetImpl;

export async function initStripe(params: { publishableKey: string }): Promise<void> {
  if (!initStripeImpl) {
    throw new Error('Stripe initialization is unavailable. Please update the app and try again.');
  }
  // The public SDK queues native configuration. PaymentSheet initialization
  // below the caller remains responsible for reporting native readiness errors.
  await initStripeImpl(params);
}
