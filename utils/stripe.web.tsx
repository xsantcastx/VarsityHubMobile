import { StripeProvider, initStripe, createNoopPaymentSheet } from './stripe.noop-shared';

export { StripeProvider, initStripe };

export const usePaymentSheet = createNoopPaymentSheet('Stripe PaymentSheet is unavailable on web.');
