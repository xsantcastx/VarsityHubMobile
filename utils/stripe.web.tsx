import React from 'react';

type StripeProviderProps = {
  children?: React.ReactNode;
};

type PaymentSheetResult = {
  error?: { message: string };
};

export function StripeProvider({ children }: StripeProviderProps) {
  return <>{children}</>;
}

export function usePaymentSheet() {
  return {
    initPaymentSheet: async (): Promise<PaymentSheetResult> => ({
      error: { message: 'Stripe PaymentSheet is unavailable on web.' },
    }),
    presentPaymentSheet: async (): Promise<PaymentSheetResult> => ({
      error: { message: 'Stripe PaymentSheet is unavailable on web.' },
    }),
  };
}

export default {
  StripeProvider,
  usePaymentSheet,
};
