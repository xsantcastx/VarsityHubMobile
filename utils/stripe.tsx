import React from 'react';
import {
  StripeProvider as NativeStripeProvider,
  usePaymentSheet as useNativePaymentSheet,
} from '@stripe/stripe-react-native';

export const StripeProvider = NativeStripeProvider;

export function usePaymentSheet() {
  return useNativePaymentSheet();
}

export default {
  StripeProvider,
  usePaymentSheet,
};
