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

export const createNoopPaymentSheet = (message: string) => () => ({
  initPaymentSheet: async () => unavailableResult(message),
  presentPaymentSheet: async () => unavailableResult(message),
});
