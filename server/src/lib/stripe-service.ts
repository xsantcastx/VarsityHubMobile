/**
 * Stripe service module
 * Handles all Stripe API interactions: session creation, webhook handling, subscription management
 * Keeps payments.ts route file focused on HTTP orchestration
 */

import Stripe from 'stripe';
import { stripeConfig } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('stripe-service');

export const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: stripeConfig.apiVersion });

/**
 * Create a membership (subscription) checkout session
 */
export async function createMembershipCheckoutSession({
  userId,
  email,
  plan,
  priceId,
  appBase,
  promoCode,
}: {
  userId: string;
  email: string;
  plan: string;
  priceId: string;
  appBase: string;
  promoCode?: string;
}): Promise<Stripe.Checkout.Session> {
  logger.debug('Creating membership checkout session', { userId, email, plan });

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
  ];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: email,
    line_items: lineItems,
    success_url: `${appBase}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBase}/billing/cancel`,
    subscription_data: {
      metadata: {
        user_id: userId,
        plan,
      },
    },
    metadata: {
      user_id: userId,
      plan,
      promo_code: promoCode || '',
    },
  });

  logger.info('Membership checkout session created', { sessionId: session.id, plan });
  return session;
}

/**
 * Create an ad reservation checkout session
 */
export async function createAdCheckoutSession({
  adId,
  email,
  priceId,
  appBase,
  quantity,
  adType,
}: {
  adId: string;
  email: string;
  priceId: string;
  appBase: string;
  quantity: number;
  adType: string;
}): Promise<Stripe.Checkout.Session> {
  logger.debug('Creating ad checkout session', { adId, email, quantity, adType });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: email,
    line_items: [{ price: priceId, quantity }],
    success_url: `${appBase}/ads/success?ad_id=${adId}`,
    cancel_url: `${appBase}/ads/cancel?ad_id=${adId}`,
    metadata: {
      ad_id: adId,
      ad_type: adType,
    },
  });

  logger.info('Ad checkout session created', { sessionId: session.id, adId, quantity });
  return session;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  logger.debug('Canceling subscription', { subscriptionId });
  const subscription = await stripe.subscriptions.cancel(subscriptionId);
  logger.info('Subscription canceled', { subscriptionId });
  return subscription;
}

/**
 * Retrieve a subscription
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Update a subscription (e.g., change plan)
 */
export async function updateSubscription(
  subscriptionId: string,
  updates: Stripe.SubscriptionUpdateParams
): Promise<Stripe.Subscription> {
  logger.debug('Updating subscription', { subscriptionId, updates });
  const subscription = await stripe.subscriptions.update(subscriptionId, updates);
  logger.info('Subscription updated', { subscriptionId });
  return subscription;
}

/**
 * Retrieve a checkout session
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(body: string, signature: string): object {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    stripeConfig.webhookSecret
  );
}

/**
 * Handle checkout.session.completed event
 */
export async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<{
  type: 'subscription' | 'payment';
  metadata: Record<string, string>;
}> {
  const metadata = (session.metadata || {}) as Record<string, string>;
  const isSubscription = session.mode === 'subscription';

  logger.info('Checkout completed', {
    sessionId: session.id,
    type: isSubscription ? 'subscription' : 'payment',
    metadata,
  });

  return {
    type: isSubscription ? 'subscription' : 'payment',
    metadata,
  };
}

/**
 * Handle invoice.payment_succeeded event
 */
export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  logger.info('Invoice payment succeeded', {
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
    customerId: invoice.customer,
  });
  // Transaction logging handled by route
}

/**
 * Handle invoice.payment_failed event
 */
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  logger.warn('Invoice payment failed', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
  });
  // Email notification handled by route
}

/**
 * Handle customer.subscription.deleted event
 */
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  logger.info('Subscription deleted', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  });
  // Cleanup handled by route
}

/**
 * Get ad price ID based on type
 */
export function getAdPriceId(adType: string): string | null {
  if (adType.includes('Mond-Thurs') || adType.includes('Weekday')) {
    return stripeConfig.prices.adWeekday || null;
  }
  if (adType.includes('Fri-Sun') || adType.includes('Weekend')) {
    return stripeConfig.prices.adWeekend || null;
  }
  logger.warn('Unknown ad type', { adType });
  return null;
}
