import { StripeProvider, createNoopPaymentSheet } from './stripe.noop-shared';

export { StripeProvider };

export const usePaymentSheet = createNoopPaymentSheet('Stripe PaymentSheet is unavailable on web.');
