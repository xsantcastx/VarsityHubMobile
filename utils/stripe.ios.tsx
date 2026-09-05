import { StripeProvider, initStripe, createNoopPaymentSheet } from './stripe.noop-shared';

export { StripeProvider, initStripe };

export const usePaymentSheet = createNoopPaymentSheet(
  'Stripe PaymentSheet is disabled on iOS. VarsityHub uses Apple In-App Purchase instead.'
);
