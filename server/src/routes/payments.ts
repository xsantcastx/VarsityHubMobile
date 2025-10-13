import expressPkg, { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { previewPromo, redeemPromo } from '../lib/promos.js';
import { calculateStripeFee, logTransaction, updateTransactionStatus } from '../lib/transactionLogger.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireVerified } from '../middleware/requireVerified.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

export const paymentsRouter = Router();

function calculatePriceCents(isoDates: string[]): number {
  if (!isoDates.length) return 0;
  let hasWeekday = false;
  let hasWeekend = false;
  for (const s of isoDates) {
    const d = new Date(s + 'T00:00:00');
    const day = d.getDay(); // 0 Sun .. 6 Sat
    if (day >= 1 && day <= 4) hasWeekday = true; else hasWeekend = true;
    if (hasWeekday && hasWeekend) break;
  }
  const weekday = 1000; // $10.00
  const weekend = 1750; // $17.50
  return (hasWeekday ? weekday : 0) + (hasWeekend ? weekend : 0);
}

const membershipPlans = ['veteran', 'legend'] as const;
type MembershipPlan = typeof membershipPlans[number];

const membershipPriceIds: Record<MembershipPlan, string | undefined> = {
  veteran: process.env.STRIPE_PRICE_VETERAN,
  legend: process.env.STRIPE_PRICE_LEGEND,
};

function membershipError(status: number, message: string) {
  const error = new Error(message);
  (error as any).statusCode = status;
  return error;
}

async function createMembershipCheckoutSession(req: AuthedRequest, planValue: unknown, promoCode?: string) {
  if (!process.env.STRIPE_SECRET_KEY) throw membershipError(500, 'Stripe not configured');
  if (typeof planValue !== 'string' || !planValue.trim()) throw membershipError(400, 'plan is required');
  const raw = planValue.trim().toLowerCase();
  if (raw !== 'veteran' && raw !== 'legend') throw membershipError(400, 'Invalid plan for subscription');
  const chosen = raw as MembershipPlan;

  // Check if user already has this exact paid plan (allow upgrades from rookie)
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const currentPlan = prefs.plan || 'rookie'; // Default to rookie if no plan set
  
  // Only block if user already has the exact same paid plan they're trying to purchase
  // Allow upgrades from rookie to veteran/legend, and between veteran/legend
  if (currentPlan === chosen) {
    throw membershipError(400, 'You already have this subscription plan');
  }

  console.log(`[payments] Plan upgrade: ${currentPlan} → ${chosen} for user ${userId}`);

  // Check for recent payments to prevent duplicates
  try {
    const recentSessions = await stripe.checkout.sessions.list({
      limit: 10,
      created: { gte: Math.floor((Date.now() - 10 * 60 * 1000) / 1000) } // Last 10 minutes
    });
    
    const recentUserSession = recentSessions.data.find(session => 
      session.metadata?.user_id === userId && 
      session.metadata?.plan === chosen &&
      session.payment_status === 'paid' // Only consider actually paid sessions
    );

    if (recentUserSession) {
      console.log('[payments] Recent PAID session found, updating user preferences from Stripe session');
      // Update user preferences from the recent successful session
      await finalizeFromSession(recentUserSession);
      throw membershipError(400, 'Payment already processed recently');
    }
  } catch (err: any) {
    if (err.statusCode) throw err; // Re-throw our custom errors
    console.warn('[payments] Failed to check recent sessions:', err?.message || err);
  }
  const priceIdRaw = membershipPriceIds[chosen];
  const normalizedPriceId = typeof priceIdRaw === 'string' ? priceIdRaw.trim() : '';
  const placeholderHints = ['price_xxx', 'price_yyy', 'your_price_id'];
  const isPlaceholder = normalizedPriceId.length === 0 || placeholderHints.some((hint) => normalizedPriceId.toLowerCase().includes(hint));
  const hasExplicitPriceId = /^price_/i.test(normalizedPriceId) && !isPlaceholder;
  if (!hasExplicitPriceId && normalizedPriceId) {
    console.warn('[payments] Ignoring invalid Stripe price id for plan', chosen, normalizedPriceId);
  }

  const lineItems = hasExplicitPriceId
    ? [{ price: normalizedPriceId, quantity: 1 }]
    : [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: chosen === 'veteran' ? 7000 : 15000,
          recurring: { interval: 'year' },
          product_data: {
            name: 'Membership - ' + chosen,
            description: chosen + ' membership (fallback price)',
          },
        },
      }];

  const appBase = process.env.APP_BASE_URL || (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000');
  // Use deep links for mobile app redirects
  const appScheme = 'varsityhubmobile';
  const success = `${appScheme}://payment-success?session_id={CHECKOUT_SESSION_ID}&type=subscription`;
  const cancel = `${appScheme}://payment-cancel`;

  // Create checkout session configuration
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    success_url: success,
    cancel_url: cancel,
    line_items: lineItems as any,
    metadata: {
      membership: '1',
      plan: chosen,
      user_id: req.user!.id,
      promo_code: promoCode || '',
    },
  };

  // Apply promo code if provided (Stripe coupon/promotion code)
  if (promoCode && typeof promoCode === 'string' && promoCode.trim()) {
    try {
      // Stripe accepts promotion codes directly in checkout sessions
      sessionConfig.discounts = [{
        promotion_code: promoCode.trim(),
      }];
      console.log(`[payments] Applying promo code to subscription: ${promoCode.trim()}`);
    } catch (promoErr) {
      console.warn('[payments] Failed to apply promo code:', promoErr);
      // Continue without promo code rather than failing
    }
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);

  // Log subscription transaction
  const currentUser = await prisma.user.findUnique({ 
    where: { id: req.user!.id },
    select: { email: true }
  });
  const amount = chosen === 'veteran' ? 7000 : 15000;
  await logTransaction({
    transactionType: 'SUBSCRIPTION_PURCHASE',
    status: 'PENDING',
    stripeSessionId: session.id,
    userId: req.user!.id,
    userEmail: currentUser?.email || 'unknown',
    subtotalCents: amount,
    taxCents: 0,
    stripeFeeeCents: calculateStripeFee(amount),
    discountCents: 0, // Will be updated in webhook when we know actual discount
    totalCents: amount, // Will be updated in webhook
    promoCode: promoCode || undefined,
    metadata: {
      plan: chosen,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return { url: session.url ?? null, sessionId: session.id };
}

// Create a Stripe Checkout Session for ad reservations
paymentsRouter.post('/checkout', expressPkg.json(), requireVerified as any, async (req: AuthedRequest, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });
  const { ad_id, dates, promo_code, plan } = req.body || {};
  if (typeof plan === 'string' && plan.trim()) {
    try {
      const { url, sessionId } = await createMembershipCheckoutSession(req, plan, promo_code);
      return res.json({ url, session_id: sessionId });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      return res.status(status).json({ error: err?.message || 'Unable to start subscription checkout' });
    }
  }
  if (!ad_id || !Array.isArray(dates) || dates.length === 0) return res.status(400).json({ error: 'ad_id and dates[] are required' });
  const isoDates: string[] = Array.from(new Set(dates.map((d: any) => String(d))));

  // Ensure ad exists
  const ad = await prisma.ad.findUnique({ where: { id: String(ad_id) } });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });

  // No global conflicts: allow multiple ads on the same date.

  const amount = calculatePriceCents(isoDates);
  if (amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  // Apply promo code if provided
  let discount = 0;
  let appliedCode: string | null = null;
  if (promo_code && typeof promo_code === 'string') {
    const preview = await previewPromo({ code: promo_code, subtotalCents: amount, userId: req.user!.id, service: 'booking' });
    if (!preview.valid) return res.status(400).json({ error: preview.reason });
    discount = preview.discount_cents;
    appliedCode = preview.code;
  }

  const total = Math.max(0, amount - discount);
  // If free after discount, finalize immediately without Stripe Checkout
  if (total === 0) {
    // Record redemption and create reservations
    if (appliedCode) {
      await redeemPromo({ code: appliedCode, subtotalCents: amount, userId: req.user!.id, service: 'booking', orderId: `FREE-${Date.now()}` });
    }
    try {
      await prisma.$transaction([
        prisma.ad.update({ where: { id: String(ad_id) }, data: { payment_status: 'paid' } }),
        prisma.adReservation.createMany({ data: isoDates.map((s) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })), skipDuplicates: true }),
      ]);
    } catch (e) {}
    return res.json({ free: true });
  }

  // Use deep links for mobile app redirects
  const appScheme = 'varsityhubmobile';
  const success = `${appScheme}://payment-success?session_id={CHECKOUT_SESSION_ID}&type=ad`;
  const cancel = `${appScheme}://payment-cancel`;

  const session = await stripe.checkout.sessions.create(({
    mode: 'payment',
    success_url: success,
    cancel_url: cancel,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: total,
          product_data: {
            name: 'Ad Reservation',
            description: `Ad ${String(ad_id)} — ${isoDates.join(', ')}`,
          },
        },
      },
    ] as any,
    // Useful metadata for webhook
    metadata: {
      ad_id: String(ad_id),
      dates: JSON.stringify(isoDates),
      user_id: req.user!.id,
      subtotal_cents: String(amount),
      promo_code: appliedCode || '',
      discount_cents: String(discount || 0),
    },
  } as Stripe.Checkout.SessionCreateParams));

  // Log transaction
  const currentUser = await prisma.user.findUnique({ 
    where: { id: req.user!.id },
    select: { email: true }
  });
  await logTransaction({
    transactionType: 'AD_PURCHASE',
    status: 'PENDING',
    stripeSessionId: session.id,
    userId: req.user!.id,
    userEmail: currentUser?.email || 'unknown',
    orderId: String(ad_id),
    subtotalCents: amount,
    taxCents: 0,
    stripeFeeeCents: calculateStripeFee(total),
    discountCents: discount,
    totalCents: total,
    promoCode: appliedCode || undefined,
    promoDiscountCents: discount,
    metadata: {
      dates: isoDates,
      adId: ad_id,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.json({ url: session.url });
});

// Stripe webhook to finalize reservations on successful payment.
// IMPORTANT: The raw body parser is registered at the app level (server/src/index.ts)
// for route /payments/webhook BEFORE express.json(). Do not add parsers here.
paymentsRouter.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    console.warn('Stripe webhook secret not configured; ignoring webhook');
    return res.status(200).json({ ignored: true });
  }
  let event: Stripe.Event;
  try {
    // req.body must be the raw Buffer provided by express.raw at app level
    event = stripe.webhooks.constructEvent((req as any).body, sig as string, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await finalizeFromSession(session);
    } catch (e) {
      console.warn('Error finalizing session in webhook:', (e as any)?.message || e);
    }
  }

  return res.json({ received: true });
});


// Create a subscription Checkout Session for recurring membership plans
paymentsRouter.post('/subscribe', expressPkg.json(), requireVerified as any, async (req: AuthedRequest, res) => {
  try {
    const { plan, promo_code } = req.body || {};
    const { url, sessionId } = await createMembershipCheckoutSession(req, plan, promo_code);
    return res.json({ url, session_id: sessionId });
  } catch (err: any) {
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
    return res.status(status).json({ error: err?.message || 'Unable to start subscription checkout' });
  }
});

// Cancel an active membership subscription
paymentsRouter.post('/subscription/cancel', expressPkg.json(), requireVerified as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};

    let subscriptionId: string | undefined = typeof prefs.subscription_id === 'string' ? prefs.subscription_id : undefined;

    if (!subscriptionId) {
      try {
        const sessions = await stripe.checkout.sessions.list({ limit: 50 });
        const found = sessions.data.find((s) => s.metadata && String(s.metadata.user_id) === String(userId) && typeof s.subscription === 'string' && s.subscription);

        if (found && found.subscription) {
          subscriptionId = String(found.subscription);
        }
      } catch (err) {
        console.warn('Failed to lookup checkout sessions while cancelling subscription:', (err as any)?.message || err);
      }
    }

    if (!subscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    try {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    } catch (err) {
      console.warn('Failed to cancel Stripe subscription:', (err as any)?.message || err);
    }

    const nextPrefs: any = { ...(prefs || {}) };
    delete nextPrefs.subscription_id;
    delete nextPrefs.subscription_period_end;
    delete nextPrefs.plan;

    await prisma.user.update({ where: { id: userId }, data: { preferences: nextPrefs } });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error cancelling subscription:', (err as any)?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Debug endpoint to check and fix subscription status discrepancies
paymentsRouter.get('/debug/subscription-status', requireVerified as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
    
    const storedPlan = prefs.plan || 'rookie';
    const storedSubscriptionId = prefs.subscription_id;
    const storedPeriodEnd = prefs.subscription_period_end;

    let stripeSubscription = null;
    let stripeStatus = null;

    // Check actual Stripe subscription status if we have a subscription ID
    if (storedSubscriptionId && process.env.STRIPE_SECRET_KEY) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(storedSubscriptionId);
        stripeStatus = stripeSubscription.status;
      } catch (err) {
        console.warn('Failed to retrieve Stripe subscription:', (err as any)?.message || err);
      }
    }

    // Check if there's a mismatch
    const hasPaidPlan = storedPlan !== 'rookie';
    const hasValidStripeSubscription = stripeStatus === 'active' || stripeStatus === 'trialing';
    const mismatch = hasPaidPlan && !hasValidStripeSubscription;

    return res.json({
      userId,
      stored: {
        plan: storedPlan,
        subscription_id: storedSubscriptionId,
        subscription_period_end: storedPeriodEnd
      },
      stripe: {
        subscription_id: stripeSubscription?.id,
        status: stripeStatus,
        current_period_end: stripeSubscription?.current_period_end ? new Date(stripeSubscription.current_period_end * 1000).toISOString() : null
      },
      mismatch,
      recommendation: mismatch ? 'Reset to rookie plan - no valid Stripe subscription found' : 'Status looks correct'
    });
  } catch (err) {
    console.error('Error checking subscription status:', (err as any)?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to reset subscription status to rookie (for fixing invalid states)
paymentsRouter.post('/debug/reset-to-rookie', requireVerified as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
    
    // Reset subscription-related preferences
    const nextPrefs: any = { ...prefs };
    nextPrefs.plan = 'rookie';
    delete nextPrefs.subscription_id;
    delete nextPrefs.subscription_period_end;
    delete nextPrefs.stripe_customer_id;
    delete nextPrefs.payment_pending;

    await prisma.user.update({ where: { id: userId }, data: { preferences: nextPrefs } });

    console.log(`[payments] Reset user ${userId} to rookie plan (debug endpoint)`);
    
    return res.json({ 
      ok: true, 
      message: 'Successfully reset to rookie plan',
      newPlan: 'rookie'
    });
  } catch (err) {
    console.error('Error resetting to rookie plan:', (err as any)?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin endpoint to reset all users with unpaid subscriptions
paymentsRouter.post('/admin/reset-unpaid-subscriptions', requireVerified as any, async (req: AuthedRequest, res) => {
  try {
    // Check if user is admin (you might want to add proper admin role checking)
    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!currentUser || currentUser.email !== 'admin@varsityhub.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('🔍 Admin-initiated bulk reset of unpaid subscriptions...');

    // Get all users and filter in JavaScript (simpler than complex Prisma query)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        display_name: true,
        preferences: true
      }
    });

    const usersToReset = allUsers.filter(user => {
      const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
      const plan = prefs.plan;
      const subscriptionId = prefs.subscription_id;
      
      // Find users with paid plans but no subscription ID
      return (plan === 'veteran' || plan === 'legend') && !subscriptionId;
    });

    console.log(`Found ${usersToReset.length} users with paid plans but no subscription ID`);

    if (usersToReset.length === 0) {
      return res.json({ 
        ok: true, 
        message: 'No users needed to be reset',
        usersReset: 0,
        usersFound: 0
      });
    }

    // Reset users
    let resetCount = 0;
    const resetUsers = [];

    for (const user of usersToReset) {
      try {
        const currentPrefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
        const nextPrefs: any = { ...currentPrefs };
        
        // Reset subscription-related preferences
        nextPrefs.plan = 'rookie';
        delete nextPrefs.subscription_id;
        delete nextPrefs.subscription_period_end;
        delete nextPrefs.stripe_customer_id;
        delete nextPrefs.payment_pending;

        await prisma.user.update({ 
          where: { id: user.id }, 
          data: { preferences: nextPrefs } 
        });

        console.log(`✅ Admin reset: ${user.email} to rookie plan`);
        resetUsers.push({
          email: user.email,
          name: user.display_name,
          previousPlan: currentPrefs.plan
        });
        resetCount++;
      } catch (error) {
        console.error(`❌ Failed to reset ${user.email}:`, (error as any)?.message || error);
      }
    }

    console.log(`[payments] Admin bulk reset completed: ${resetCount}/${usersToReset.length} users`);
    
    return res.json({ 
      ok: true, 
      message: `Successfully reset ${resetCount} users to rookie plan`,
      usersReset: resetCount,
      usersFound: usersToReset.length,
      resetUsers
    });
  } catch (err) {
    console.error('Error in admin bulk reset:', (err as any)?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Authenticated helper to finalize a Checkout Session by id when webhooks are unavailable
paymentsRouter.post('/finalize-session', expressPkg.json(), requireVerified as any, async (req: AuthedRequest, res) => {
  try {
    const { session_id } = req.body || {};
    if (!session_id || typeof session_id !== 'string') return res.status(400).json({ error: 'session_id required' });
    if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.payment_status !== 'paid') {
        return res.status(202).json({ pending: true, payment_status: session.payment_status, status: session.status });
      }
      await finalizeFromSession(session as Stripe.Checkout.Session);
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to finalize session:', (err as any)?.message || err);
      return res.status(500).json({ error: 'Failed to finalize session' });
    }
  } catch (err) {
    console.error('Finalize-session error:', (err as any)?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Optional helper to finalize payment based on a Checkout Session's metadata (fallback if webhook is not configured)
async function finalizeFromSession(session: Stripe.Checkout.Session) {
  console.log('[payments] finalizeFromSession called', {
    session_id: session.id,
    payment_status: session.payment_status,
    status: session.status,
    metadata: session.metadata
  });
  
  const meta = session.metadata || {};
  const ad_id = meta.ad_id || '';
  let dates: string[] = [];
  try { dates = JSON.parse(String(meta.dates || '[]')); } catch {}
  if (ad_id && Array.isArray(dates) && dates.length) {
    console.log('[payments] Processing ad reservation payment', {
      ad_id,
      dates,
      session_id: session.id,
      payment_status: session.payment_status
    });
    try {
      const result = await prisma.$transaction([
        prisma.ad.update({ 
          where: { id: ad_id }, 
          data: { 
            payment_status: 'paid',
            status: 'active' // Mark ad as active when payment is completed
          } 
        }),
        prisma.adReservation.createMany({ data: dates.map((s) => ({ ad_id, date: new Date(s + 'T00:00:00.000Z') })), skipDuplicates: true }),
      ]);
      console.log('[payments] Ad reservation payment completed successfully', {
        ad_id,
        dates,
        session_id: session.id,
        status: 'active'
      });
      
      // Update transaction log to COMPLETED
      await updateTransactionStatus(session.id, 'COMPLETED', {
        stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : undefined,
      });
    } catch (e) {
      console.error('[payments] Error processing ad reservation payment', {
        ad_id,
        dates,
        session_id: session.id,
        error: e
      });
      // Don't ignore the error silently anymore
      throw e;
    }
  }

  const code = (meta.promo_code || '').trim();
  const userId = meta.user_id || '';
  const subtotalCents = Number(meta.subtotal_cents || 0) || 0;

  const plan = typeof meta.plan === 'string' ? meta.plan.trim() : '';
  const metaMembership = String(meta.membership || '').trim();
  const isMembership = metaMembership === '1' || metaMembership === 'true' || plan.length > 0;
  if (isMembership && userId && plan.length > 0) {
    // Only finalize if payment was actually successful
    const paid = session.payment_status === 'paid';
    console.log('[payments] finalize membership check', { 
      session_id: session.id, 
      payment_status: session.payment_status, 
      status: session.status, 
      paid,
      userId,
      plan 
    });
    
    if (!paid) {
      console.warn('[payments] finalize membership skipped (unpaid session)', { 
        session_id: session.id, 
        status: session.status, 
        payment_status: session.payment_status,
        userId,
        plan
      });
      return; // Critical fix: don't continue processing unpaid sessions
    } else {
      try {
        const current = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const existingPrefs = (current?.preferences && typeof current.preferences === 'object') ? (current.preferences as any) : {};
        const prefs: any = { ...existingPrefs, plan };
        if (session.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(String(session.subscription));
            if (sub && sub.id) {
              prefs.subscription_id = String(sub.id);
              if (sub.current_period_end) {
                prefs.subscription_period_end = new Date(Number(sub.current_period_end) * 1000).toISOString();
              }
            }
          } catch (err) {
            console.warn('Failed to retrieve subscription details:', (err as any)?.message || err);
          }
        }
        if (session.customer) {
          prefs.stripe_customer_id = String(session.customer);
        }
        await prisma.user.update({ where: { id: userId }, data: { preferences: prefs } });
        console.info('[payments] membership finalize', { userId, plan, subscription_id: prefs.subscription_id, subscription_period_end: prefs.subscription_period_end });
        
        // Update transaction log to COMPLETED
        await updateTransactionStatus(session.id, 'COMPLETED', {
          stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : undefined,
          stripeSubscriptionId: session.subscription ? String(session.subscription) : undefined,
        });
      } catch (err) {
        console.warn('Failed to finalize membership from session:', (err as any)?.message || err);
      }
    }
  }

  if (code && userId && subtotalCents > 0) {
    try {
      await redeemPromo({ code, userId, subtotalCents, service: 'booking', orderId: session.id });
    } catch (e) {
      // ignore
    }
  }
}

// Human-facing pages for success/cancel, with success also attempting confirmation if session_id present
paymentsRouter.get('/success', async (req, res) => {
  const appScheme = process.env.APP_SCHEME || 'varsityhubmobile';
  const appReturnPath = process.env.APP_RETURN_PATH || '';
  const returnUrl = `${appScheme}://${appReturnPath}`;
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : undefined;
  if (sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session && session.payment_status === 'paid') {
        await finalizeFromSession(session);
      }
    } catch (e) {
      // ignore
    }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payment Successful</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .box { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; max-width: 520px; box-shadow: 0 6px 20px rgba(2,6,23,0.06); text-align: center; }
      .title { font-size: 20px; font-weight: 800; margin-bottom: 6px; }
      .muted { color: #64748b; }
      .btn { display: inline-block; margin-top: 12px; padding: 10px 14px; border-radius: 10px; background: #111827; color: #fff; font-weight: 800; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="box">
      <div class="title">Payment successful</div>
      <div class="muted">Your ad dates will appear shortly. You can return to the app now.</div>
      <a href="${returnUrl}" class="btn">Return to app</a>
      <br/>
      <a href="#" class="btn" onclick="window.close(); return false;">Close</a>
    </div>
    <script>
      setTimeout(function(){ try { window.location = '${returnUrl}'; } catch (e) {} }, 400);
    </script>
  </body>
</html>`);
});

paymentsRouter.get('/cancel', (_req, res) => {
  const appScheme = process.env.APP_SCHEME || 'varsityhubmobile';
  const appReturnPath = process.env.APP_RETURN_PATH || '';
  const returnUrl = `${appScheme}://${appReturnPath}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payment Canceled</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .box { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; max-width: 520px; box-shadow: 0 6px 20px rgba(2,6,23,0.06); text-align: center; }
      .title { font-size: 20px; font-weight: 800; margin-bottom: 6px; }
      .muted { color: #64748b; }
      .btn { display: inline-block; margin-top: 12px; padding: 10px 14px; border-radius: 10px; background: #111827; color: #fff; font-weight: 800; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="box">
      <div class="title">Payment canceled</div>
      <div class="muted">Your payment was canceled. You may return to the app to try again.</div>
      <a href="${returnUrl}" class="btn">Return to app</a>
      <br/>
      <a href="#" class="btn" onclick="window.close(); return false;">Close</a>
    </div>
    <script>
      setTimeout(function(){ try { window.location = '${returnUrl}'; } catch (e) {} }, 400);
    </script>
  </body>
</html>`);
});



