import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';

// Lazy load Stripe only if key present to avoid runtime crash in dev
let stripe: any = null;
const key = process.env.STRIPE_SECRET_KEY;
// Warn if using a live key during development/QA
if (key && /^sk_live_/.test(String(key)) && process.env.NODE_ENV !== 'production') {
  console.warn('[billing] WARNING: Live Stripe key detected in non-production environment. Use sk_test_* for QA.');
}
if (key) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require('stripe');
  stripe = new Stripe(key, { apiVersion: '2023-10-16' });
}

export const billingRouter = Router();

billingRouter.post('/checkout/create-session', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { plan, team_count } = req.body || {};
  if (!plan || !['veteran','legend'].includes(String(plan))) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  // Validate team_count for Veteran plan
  if (plan === 'veteran') {
    const totalTeams = Number(team_count) || 0;
    if (totalTeams < 3) {
      return res.status(400).json({ 
        error: 'Veteran plan requires at least 3 teams',
        minimum_teams: 3,
        provided_teams: totalTeams
      });
    }
  }
  if (!stripe) {
    return res.status(503).json({ error: 'BillingUnavailable', message: 'Stripe not configured on server.' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const email = user?.email;
    const veteranPrice = process.env.STRIPE_PRICE_VETERAN || process.env.STRIPE_VETERAN_PRICE_ID;
    const legendPrice = process.env.STRIPE_PRICE_LEGEND || process.env.STRIPE_LEGEND_PRICE_ID;
    if (!veteranPrice) {
      return res.status(500).json({ error: 'Missing price IDs' });
    }

    // Legend should be a one-time annual charge to avoid Stripe's monthly breakdown text
    if (plan === 'legend') {
      const session = await stripe.checkout.sessions.create({
        customer_email: email || undefined,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: 1999, // $19.99 annual (one-time)
              product_data: {
                name: 'Legend Plan',
                description: 'Annual access for unlimited teams (one-time charge)',
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/payment-cancel`,
        metadata: {
          user_id: req.user.id,
          plan,
          team_count: team_count || '0',
          team_count_total: team_count || '0',
        },
      });
      return res.json({ session_id: session.id, url: session.url });
    }

    // Veteran remains a subscription
    const priceId = veteranPrice;
    const totalTeams = Number(team_count) || 0;
    const billable = Math.max(0, totalTeams - 2);
    if (billable === 0) {
      return res.status(400).json({ error: 'Select at least one billable team (3 total) to use Veteran plan' });
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: email || undefined,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [ { price: priceId, quantity: billable } ],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/payment-cancel`,
      metadata: {
        user_id: req.user.id,
        plan,
        team_count: team_count || '0',
        team_count_total: team_count || '0'
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
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;
      const teamCountTotal = session.metadata?.team_count_total || session.metadata?.team_count;
      if (userId && plan) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const existingPrefs = user?.preferences || {};
        const prefsUpdate: any = {
          ...(existingPrefs as object),
          plan,
          payment_pending: false
        };
        // Persist team_count_total for Veteran plan
        if (plan === 'veteran' && teamCountTotal) {
          prefsUpdate.team_count_total = Number(teamCountTotal) || 0;
        }
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscription_tier: plan,
            subscription_status: 'active',
            stripe_customer_id: session.customer?.toString(),
            preferences: prefsUpdate
          }
        });
      }
    }
  } catch (e) {
    console.error('[billing] webhook processing error', e);
  }
  return res.json({ received: true });
});
