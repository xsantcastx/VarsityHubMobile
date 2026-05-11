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

export const StripeProvider: React.ComponentType<any> = ({ children }) => <>{children}</>;

export const usePaymentSheet = () => ({
  initPaymentSheet: async () =>
    unavailableResult('Stripe PaymentSheet is disabled on iOS. VarsityHub uses Apple In-App Purchase instead.'),
  presentPaymentSheet: async () =>
    unavailableResult('Stripe PaymentSheet is disabled on iOS. VarsityHub uses Apple In-App Purchase instead.'),
});
