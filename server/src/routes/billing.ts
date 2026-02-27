import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';

// Lazy load Stripe only if key present to avoid runtime crash in dev
let stripe: any = null;
const key = process.env.STRIPE_SECRET_KEY;
if (key) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require('stripe');
  stripe = new Stripe(key, { apiVersion: '2023-10-16' });
}

export const billingRouter = Router();

const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl && process.env.NODE_ENV === 'production') {
  throw new Error('FRONTEND_URL must be set in production');
}

billingRouter.post('/checkout/create-session', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { plan, team_count } = req.body || {};
  if (!plan || !['veteran','legend'].includes(String(plan))) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  if (!stripe) {
    return res.status(503).json({ error: 'BillingUnavailable', message: 'Stripe not configured on server.' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const email = user?.email;
    const veteranPrice = process.env.STRIPE_PRICE_VETERAN;
    const legendPrice = process.env.STRIPE_PRICE_LEGEND;
    if (!veteranPrice || !legendPrice) {
      return res.status(500).json({ error: 'Missing price IDs' });
    }

    let priceId = plan === 'veteran' ? veteranPrice : legendPrice;
    let quantity = 1;
    if (plan === 'veteran') {
      const totalTeams = Number(team_count) || 0;
      quantity = Math.max(0, totalTeams - 2) || 1; // Always at least 1 item so session starts
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: email || undefined,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [ { price: priceId, quantity } ],
      success_url: `${frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/payment-cancel`,
      metadata: {
        user_id: req.user.id,
        plan,
        team_count: team_count
      }
    });
    return res.json({ session_id: session.id, url: session.url });
  } catch (e: any) {
    console.error('[billing] create-session failed', e);
    return res.status(500).json({ error: 'Failed to create billing session', message: e?.message });
  }
});

// Stripe webhook (raw body expected - configure in main server setup)
billingRouter.post('/webhooks/stripe', async (req: AuthedRequest, res) => {
  if (!stripe) return res.status(503).json({ error: 'BillingUnavailable' });
  const sig = req.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: 'Missing webhook secret' });
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[billing] webhook signature failed', err?.message || err);
    return res.status(400).send('Webhook Error: Invalid signature');
  }

  // Event-level deduplication: reject replayed webhook events
  try {
    await prisma.processedStripeEvent.create({
      data: { event_id: event.id, event_type: event.type },
    });
  } catch (dedupErr: any) {
    if (dedupErr?.code === 'P2002') {
      console.warn('[billing] Duplicate event skipped', event.id, event.type);
      return res.json({ received: true, deduplicated: true });
    }
    // Non-unique error — log warning but proceed
    console.warn('[billing] Failed to record event for dedup, proceeding anyway:', dedupErr?.message || dedupErr);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      // Security: Only process if payment was actually successful
      if (session.payment_status !== 'paid') {
        console.warn('[billing] Webhook skipped - session not paid', {
          session_id: session.id,
          payment_status: session.payment_status,
          status: session.status
        });
        return res.json({ received: true, skipped: true });
      }
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;
      if (userId && plan) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const existingPrefs = user?.preferences || {};
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscription_tier: plan,
            subscription_status: 'active',
            stripe_customer_id: session.customer?.toString(),
            preferences: {
              ...(existingPrefs as object),
              plan,
              payment_pending: false
            }
          }
        });
      }
    }
  } catch (e) {
    console.error('[billing] webhook processing error', e);
  }
  return res.json({ received: true });
});
