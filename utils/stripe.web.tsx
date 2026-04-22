// Web platform variant of utils/stripe.
//
// The previous single-file shim gated the require('@stripe/stripe-react-native')
// call behind `Platform.OS !== 'web'`, but Metro's web bundler follows the
// string literal statically during resolution and pulls in the native-only
// module anyway — which then throws "importing a module from 'react-native'
// instead of 'react-native-web'" at bundle time. Metro's platform-specific
// resolver picks this file on web, avoiding the require entirely.
//
// Keep the exported shape identical to utils/stripe.tsx so none of the call
// sites need a platform check of their own.

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
    unavailableResult('Stripe PaymentSheet is unavailable on web.'),
  presentPaymentSheet: async () =>
    unavailableResult('Stripe PaymentSheet is unavailable on web.'),
});
