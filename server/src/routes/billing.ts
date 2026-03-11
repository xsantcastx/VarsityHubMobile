import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

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

billingRouter.post('/checkout/create-session', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { plan: bodyPlan, team_count } = req.body || {};

  // Rule A: Verify admin has approved this coach before allowing checkout.
  // Read pending_plan from profile if plan not in request body.
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const plan = bodyPlan || prefs.pending_plan;

  if (!plan || !['veteran','legend'].includes(String(plan))) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  // Block checkout if admin hasn't approved yet — only for coaches with pending join requests
  if (prefs.payment_pending === true && prefs.payment_approved !== true && prefs.join_request_pending === true) {
    return res.status(403).json({
      error: 'APPROVAL_REQUIRED',
      message: 'Your league admin must approve your account before you can subscribe.'
    });
  }

  if (!stripe) {
    return res.status(503).json({ error: 'BillingUnavailable', message: 'Stripe not configured on server.' });
  }
  try {
    const email = user?.email;
    const veteranPrice = process.env.STRIPE_PRICE_VETERAN;
    const legendPrice = process.env.STRIPE_PRICE_LEGEND;
    if (!veteranPrice || !legendPrice) {
      return res.status(500).json({ error: 'Missing price IDs' });
    }

    let priceId = plan === 'veteran' ? veteranPrice : legendPrice;
    let quantity = 1;
    if (plan === 'veteran') {
      // Use team_count from request body, or fall back to stored team_count_total from onboarding
      const totalTeams = Number(team_count) || Number(prefs.team_count_total) || 0;
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
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy webhook removed — all Stripe webhooks are handled in payments.ts
