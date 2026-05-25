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
} catch (error) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[stripe] native Stripe module unavailable:', (error as Error)?.message);
  }
}

export const StripeProvider = StripeProviderImpl;
export const usePaymentSheet = usePaymentSheetImpl;
