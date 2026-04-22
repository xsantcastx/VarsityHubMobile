// Native platform variant of utils/stripe. Metro's resolver selects
// utils/stripe.web.tsx on web, so this file is only ever bundled for
// iOS/Android — which means the `require('@stripe/stripe-react-native')`
// string literal never reaches the web bundler. Previously we gated on
// `Platform.OS !== 'web'`, but Metro follows the require() statically during
// web resolution and pulled in the native-only module anyway, producing
// "importing a module from 'react-native' instead of 'react-native-web'"
// at bundle time.
//
// The try/catch is still worth keeping on native: it protects against
// environments like Expo Go or a simulator build where the native code
// didn't link (falls back to a no-op instead of crashing at import).

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
  initPaymentSheet: async () => unavailableResult('Stripe PaymentSheet is unavailable (native module failed to load).'),
  presentPaymentSheet: async () => unavailableResult('Stripe PaymentSheet is unavailable (native module failed to load).'),
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
