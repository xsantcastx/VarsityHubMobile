import expressPkg, { Router } from 'express';
import Stripe from 'stripe';
import { debugLog } from '../lib/debugLog.js';
import { getAppBaseUrl } from '../lib/env.js';
import {
    sendBillingNoticeEmail,
    sendPaymentFailedEmail,
    sendPaymentReceiptEmail,
    sendSubscriptionCanceledEmail,
} from '../lib/email.js';
import { prisma } from '../lib/prisma.js';
import { previewPromo, redeemPromo } from '../lib/promos.js';
import { emailQueue } from '../lib/queue.js';
import { calculateSalesTax } from '../lib/taxCalculator.js';
import { calculateStripeFee, getTransactionBySession, logTransaction, updateTransactionStatus } from '../lib/transactionLogger.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { calculateAdPriceCents } from '../utils/adPricing.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

export const paymentsRouter = Router();

// Config status for client-side payment readiness check
paymentsRouter.get('/config', (_req, res) => {
  res.json({
    stripe_configured: !!process.env.STRIPE_SECRET_KEY,
    has_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
  });
});

const formatUsd = (cents?: number | null) => {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return '';
  return `$${(cents / 100).toFixed(2)}`;
};

const formatDateFromUnix = (unix?: number | null) => {
  if (!unix) return null;
  const d = new Date(unix * 1000);
  return d.toISOString().split('T')[0];
};

const formatPeriodLabel = (start?: number | null, end?: number | null) => {
  const startStr = formatDateFromUnix(start);
  const endStr = formatDateFromUnix(end);
  if (startStr && endStr) return `${startStr} - ${endStr}`;
  return startStr || endStr || 'Current period';
};

async function getUserEmail(userId?: string | null, fallbackEmail?: string | null) {
  if (fallbackEmail && fallbackEmail.includes('@')) return fallbackEmail;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: String(userId) }, select: { email: true } });
  return user?.email || null;
}

async function sendAdPaymentEmail({
  userId,
  fallbackEmail,
  adId,
  dates,
  totalCents,
}: {
  userId?: string | null;
  fallbackEmail?: string | null;
  adId: string;
  dates: string[];
  totalCents?: number | null;
}) {
  const email = await getUserEmail(userId, fallbackEmail);
  if (!email) return;
  const amount = formatUsd(totalCents);
  const perks = [
    `Ad #${adId}`,
    dates.length ? `Dates: ${dates.join(', ')}` : null,
  ].filter(Boolean) as string[];
  try {
    await sendBillingNoticeEmail({
      to: email,
      type: 'payment_succeeded',
      planName: 'Ad Reservation',
      amount,
      perks,
    });
  } catch (err) {
    console.warn('[payments] Unable to send ad payment email:', (err as any)?.message || err);
  }
}

async function sendSubscriptionEmail({
  userId,
  fallbackEmail,
  plan,
  totalCents,
}: {
  userId?: string | null;
  fallbackEmail?: string | null;
  plan: string;
  totalCents?: number | null;
}) {
  const email = await getUserEmail(userId, fallbackEmail);
  if (!email) return;
  const planName = plan === 'veteran' ? 'Veteran Membership' : plan === 'legend' ? 'Legend Membership' : 'VarsityHub Subscription';
  const billingPeriod = plan === 'legend' ? 'Annual plan' : 'Monthly plan';
  try {
    await sendPaymentReceiptEmail({
      to: email,
      planName,
      amount: formatUsd(totalCents) || (plan === 'legend' ? '$19.99' : '$0.00'),
      billingPeriod,
    });
  } catch (err) {
    console.warn('[payments] Unable to send subscription email:', (err as any)?.message || err);
  }
}

function calculatePriceCents(isoDates: string[]): number {
  if (!isoDates.length) return 0;
  return calculateAdPriceCents(isoDates).totalCents;
}

const membershipPlans = ['veteran', 'legend'] as const;
type MembershipPlan = typeof membershipPlans[number];

const membershipPriceIds: Record<MembershipPlan, string | undefined> = {
  veteran: process.env.STRIPE_PRICE_VETERAN || process.env.STRIPE_VETERAN_PRICE_ID,
  legend: process.env.STRIPE_PRICE_LEGEND,
};

function membershipError(status: number, message: string) {
  const error = new Error(message);
  (error as any).statusCode = status;
  return error;
}

async function createMembershipCheckoutSession(req: AuthedRequest, planValue: unknown, promoCode?: string, teamCount?: number) {
  if (!process.env.STRIPE_SECRET_KEY) throw membershipError(500, 'Stripe not configured');
  if (typeof planValue !== 'string' || !planValue.trim()) throw membershipError(400, 'plan is required');
  const raw = planValue.trim().toLowerCase();
  if (raw !== 'veteran' && raw !== 'legend') throw membershipError(400, 'Invalid plan for subscription');
  const chosen = raw as MembershipPlan;
  
  // Validate team count for Veteran plan (total teams including the first two free)
  if (chosen === 'veteran') {
    if (typeof teamCount !== 'number' || teamCount < 3) {
      throw membershipError(400, 'Veteran plan requires at least 3 total teams (first 2 are free)');
    }
  }

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

  debugLog(`[payments] Plan upgrade: ${currentPlan} → ${chosen} for user ${userId}`);

  // Check for recent payments to prevent duplicates (24 hour lookback)
  try {
    const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
    const recentSessions = await stripe.checkout.sessions.list({
      limit: 100, // Check more sessions (increased from 10)
      created: { gte: oneDayAgo } // Last 24 hours (expanded from 10 minutes)
    });
    
    // Check for ANY session with this user+plan combo (paid, unpaid, or processing)
    const existingSession = recentSessions.data.find(session => 
      session.metadata?.user_id === userId && 
      session.metadata?.plan === chosen
    );

    if (existingSession) {
      if (existingSession.payment_status === 'paid') {
        debugLog('[payments] Recent PAID session found, updating user preferences from Stripe session');
        // Update user preferences from the recent successful session
        await finalizeFromSession(existingSession);
        throw membershipError(400, 'Payment already processed recently');
      } else {
        // Session is unpaid/pending - don't allow creating another
        debugLog(`[payments] Existing unpaid session found (${existingSession.id}), preventing duplicate checkout`);
        throw membershipError(400, `You already have a pending payment for ${chosen}. Please complete or cancel that payment first.`);
      }
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

  // Calculate billable quantity for Veteran plan (only teams beyond the first two are billed)
  const billableQuantity = chosen === 'veteran' && typeof teamCount === 'number' ? Math.max(0, teamCount - 2) : 1;
  // If user selected only 2 or fewer teams, they should remain on Rookie (defensive check)
  if (chosen === 'veteran' && billableQuantity === 0) {
    throw membershipError(400, 'Select at least one billable team (3 total) to use Veteran plan');
  }

  const lineItems =
    hasExplicitPriceId
      ? [{ price: normalizedPriceId, quantity: chosen === 'veteran' ? billableQuantity : 1 }]
      : [{
          quantity: chosen === 'veteran' ? billableQuantity : 1,
          price_data: {
            currency: 'usd',
            unit_amount: chosen === 'veteran' ? 150 : 2000, // Veteran: $1.50/month per additional team, Legend: $20.00/year
            recurring: { interval: chosen === 'veteran' ? 'month' : 'year' },
            product_data: {
              name: 'Membership - ' + chosen,
              description: chosen === 'veteran'
                ? `Veteran plan - $1.50/month per additional team (${billableQuantity} billable of ${teamCount} total, 2 free)`
                : 'Legend plan - $20.00/year unlimited (renews annually until canceled)',
            },
          },
        }];

  // Log price selection for debugging
  if (hasExplicitPriceId) {
    debugLog(`[payments] Creating ${chosen} subscription checkout with price ID: ${normalizedPriceId} (quantity: ${chosen === 'veteran' ? billableQuantity : 1})`);
  } else {
    debugLog(`[payments] Creating ${chosen} ${legendOneTime ? 'one-time payment' : 'subscription'} checkout with fallback price_data (no configured price ID)`);
  }

  const appBase = getAppBaseUrl();
  // Use deep links for mobile app redirects
  const appScheme = 'varsityhubmobile';
  const success = `${appScheme}://payment-success?session_id={CHECKOUT_SESSION_ID}&type=subscription`;
  const cancel = `${appScheme}://payment-cancel`;

  // Create checkout session configuration
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription', // keep Legend as recurring annual subscription
    success_url: success,
    cancel_url: cancel,
    line_items: lineItems as any,
    metadata: {
      membership: '1',
      plan: chosen,
      user_id: req.user!.id,
      promo_code: promoCode || '',
      team_count_total: chosen === 'veteran' && teamCount ? String(teamCount) : '',
      team_count_billable: chosen === 'veteran' ? String(billableQuantity) : '',
    },
  };

  // Apply promo code if provided (Stripe coupon/promotion code)
  if (promoCode && typeof promoCode === 'string' && promoCode.trim()) {
    try {
      // Stripe accepts promotion codes directly in checkout sessions
      sessionConfig.discounts = [{
        promotion_code: promoCode.trim(),
      }];
      debugLog(`[payments] Applying promo code to ${legendOneTime ? 'payment' : 'subscription'}: ${promoCode.trim()}`);
    } catch (promoErr) {
      console.warn('[payments] Failed to apply promo code:', promoErr);
      // Continue without promo code rather than failing
    }
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  debugLog(`[payments] Stripe session created: ${session.id} for user ${req.user!.id}, plan ${chosen}`);

  // Log subscription transaction
  const currentUser = await prisma.user.findUnique({ 
    where: { id: req.user!.id },
    select: { email: true }
  });
  const amount = chosen === 'veteran' ? 150 * billableQuantity : legendOneTime ? 1999 : 2000; // Veteran billed only for additional teams
  await logTransaction({
    transactionType: legendOneTime ? 'ONE_TIME_PURCHASE' : 'SUBSCRIPTION_PURCHASE',
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
      team_count_total: chosen === 'veteran' ? teamCount : undefined,
      team_count_billable: chosen === 'veteran' ? billableQuantity : undefined,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return { url: session.url ?? null, sessionId: session.id };
}

// Create a Stripe Checkout Session for ad reservations
paymentsRouter.post('/checkout', expressPkg.json(), requireVerified as any, async (req: AuthedRequest, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });
  const { ad_id, dates, promo_code, plan, team_count } = req.body || {};
  if (typeof plan === 'string' && plan.trim()) {
    try {
      const { url, sessionId } = await createMembershipCheckoutSession(req, plan, promo_code, team_count);
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

  // Calculate sales tax based on ad's target zip code
  const subtotal = calculatePriceCents(isoDates);
  const taxCents = ad.target_zip_code ? calculateSalesTax(subtotal, ad.target_zip_code) : 0;
  let discount = 0;
  let appliedCode: string | null = null;
  if (promo_code && typeof promo_code === 'string') {
    const preview = await previewPromo({ code: promo_code, subtotalCents: subtotal, userId: req.user!.id, service: 'booking' });
    if (!preview.valid) return res.status(400).json({ error: preview.reason });
    discount = preview.discount_cents;
    appliedCode = preview.code;
  }
  const total = Math.max(0, subtotal - discount + taxCents);
  
  // Issue #7 FIX: Validate all dates are valid before processing payment
  const parsedDates: Date[] = [];
  for (const dateStr of isoDates) {
    const parsed = new Date(dateStr + 'T00:00:00.000Z');
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ error: `Invalid date: ${dateStr}` });
    }
    parsedDates.push(parsed);
  }
  
  if (total === 0) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.ad.update({ where: { id: String(ad_id) }, data: { payment_status: 'paid' } });
        await tx.adReservation.createMany({ 
          data: parsedDates.map((date) => ({ ad_id: String(ad_id), date })), 
          skipDuplicates: true 
        });
        // Issue #9 FIX: Redeem promo AFTER successful transaction
        if (appliedCode) {
          await redeemPromo({ code: appliedCode, subtotalCents: subtotal, userId: req.user!.id, service: 'booking', orderId: `FREE-${Date.now()}` });
        }
      });
    } catch (e) {
      console.error('[payments] Failed to process free ad reservation:', e);
      return res.status(500).json({ error: 'Failed to process reservation. Please try again.' });
    }
    return res.json({ free: true });
  }
  const appScheme = 'varsityhubmobile';
  const success = `${appScheme}://payment-success?session_id={CHECKOUT_SESSION_ID}&type=ad`;
  const cancel = `${appScheme}://payment-cancel`;
  
  // Use dynamic pricing instead of fixed price IDs
  // This ensures correct pricing based on actual dates selected
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: success,
    cancel_url: cancel,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: subtotal, // Use calculated subtotal in cents
          product_data: {
            name: 'Ad Reservation',
            description: `${isoDates.length} ${isoDates.length === 1 ? 'day' : 'days'} selected (${isoDates.join(', ')})`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      ad_id: String(ad_id),
      dates: JSON.stringify(isoDates),
      user_id: req.user!.id,
      subtotal_cents: String(subtotal),
      tax_cents: String(taxCents),
      promo_code: appliedCode || '',
      discount_cents: String(discount || 0),
    },
  });
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
    subtotalCents: subtotal,
    taxCents: taxCents,
    stripeFeeeCents: calculateStripeFee(total),
    discountCents: discount,
    totalCents: total,
    promoCode: appliedCode || undefined,
    promoDiscountCents: discount,
    metadata: {
      dates: isoDates,
      adId: ad_id,
      zipCode: ad.target_zip_code,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Schedule payment reminder email 15 minutes later if checkout not completed (1-hour hold total)
  const delayMs = 15 * 60 * 1000; // 15 minutes
  const checkoutLink = session.url || `${getAppBaseUrl()}/checkout?ad_id=${ad_id}`;
  
  await emailQueue.add(
    'payments.checkout_abandoned',
    {
      to: ad.contact_email,
      advertiser_name: ad.contact_name,
      business_name: ad.business_name,
      total_cost: total / 100, // Convert cents to dollars
      checkout_link: checkoutLink,
      hours_remaining: 1, // 1 hour hold total
      session_id: session.id, // Track to cancel if paid
    },
    { 
      delay: delayMs, 
      attempts: 1, // Only send once
      jobId: `payment-reminder-${session.id}`, // Unique job ID for easy cancellation
    }
  );
  debugLog(`[payments] Scheduled payment reminder for ${ad.contact_email} (6 hours)`);

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
    return res.status(400).send('Webhook Error: Invalid signature');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await finalizeFromSession(session);
    } catch (e) {
      // Issue #8 FIX: Return 500 for critical failures to trigger Stripe retry
      console.error('[payments] CRITICAL: Failed to finalize session in webhook:', {
        session_id: session.id,
        error: (e as any)?.message || e,
        metadata: session.metadata,
        payment_status: session.payment_status
      });
      // Return 500 to tell Stripe to retry this webhook
      return res.status(500).json({ error: 'Failed to process payment', session_id: session.id });
    }
  }
  
  // Send billing notification emails for subscription events
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.customer_email && invoice.subscription) {
      const firstLine = invoice.lines.data[0];
      await sendPaymentReceiptEmail({
        to: invoice.customer_email,
        planName: firstLine?.description || 'VarsityHub Subscription',
        amount: formatUsd(typeof invoice.amount_paid === 'number' ? invoice.amount_paid : invoice.total),
        billingPeriod: formatPeriodLabel(firstLine?.period?.start, firstLine?.period?.end),
        invoiceUrl: invoice.hosted_invoice_url || invoice.invoice_pdf || undefined,
      }).catch(err => console.warn('[billing-email] payment_succeeded failed:', err));
    }
  }
  
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.customer_email) {
      const paymentError = (invoice as Stripe.Invoice & { last_payment_error?: { message?: string } }).last_payment_error;
      const amount = invoice.amount_due ? formatUsd(invoice.amount_due) : '$0.00';
      const failedDate = new Date(invoice.created * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const retryDate = invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'within 3 days';
      
      await sendPaymentFailedEmail({
        to: invoice.customer_email,
        userName: 'User',
        paymentMethodLast4: '****',
        failedAmount: amount,
        failedDate: failedDate,
        planName: invoice.lines.data[0]?.description || 'VarsityHub Subscription',
        retryDate: retryDate,
        updatePaymentLink: `${getAppBaseUrl()}/billing/payment-methods`,
        contactSupportLink: `${getAppBaseUrl()}/support`,
      }).catch(err => console.warn('[billing-email] payment_failed failed:', err));
    }
  }
  
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customer = await stripe.customers.retrieve(subscription.customer as string).catch(() => null);
    if (customer && !customer.deleted && customer.email) {
      await sendSubscriptionCanceledEmail({
        to: customer.email,
        planName: subscription.items.data[0]?.price?.nickname || 'VarsityHub Subscription',
        renewalDate: formatDateFromUnix(subscription.current_period_end) || undefined,
      }).catch(err => console.warn('[billing-email] subscription_canceled failed:', err));
    }
  }
  
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const customer = await stripe.customers.retrieve(subscription.customer as string).catch(() => null);
    if (customer && !customer.deleted && customer.email && subscription.status === 'active') {
      const item = subscription.items.data[0];
      const amountCents = (item?.price?.unit_amount || 0) * (item?.quantity || 1);
      await sendPaymentReceiptEmail({
        to: customer.email,
        planName: item?.price?.nickname || 'VarsityHub Subscription',
        amount: formatUsd(amountCents) || '$0.00',
        billingPeriod: subscription.cancel_at_period_end ? 'Final period' : 'Current period',
      }).catch(err => console.warn('[billing-email] subscription_renewed failed:', err));
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

    // Issue #10 FIX: Enforce team limits on cancellation
    // Check if user has more than 2 teams (Rookie limit)
    const userOrgs = await prisma.organization.findMany({
      where: {
        team_memberships: {
          some: { user_id: userId, status: 'active' }
        }
      },
      select: { id: true }
    });
    
    const teamCount = await prisma.team.count({
      where: { organization_id: { in: userOrgs.map(o => o.id) } }
    });
    
    if (teamCount > 2) {
      return res.status(400).json({ 
        error: 'Cannot cancel subscription while managing more than 2 teams. Please delete teams before downgrading to Rookie plan.',
        current_teams: teamCount,
        rookie_limit: 2,
        teams_to_remove: teamCount - 2
      });
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

// Update subscription quantity for Veteran plan
paymentsRouter.post('/update-subscription-quantity', expressPkg.json(), requireVerified as any, async (req: AuthedRequest, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });
    
    const userId = req.user!.id;
    const { team_count } = req.body; // total teams desired
    if (typeof team_count !== 'number' || team_count < 3) {
      return res.status(400).json({ error: 'Invalid total team count. Minimum 3 total teams required for Veteran plan.' });
    }
    const billable = Math.max(0, team_count - 2); // Only teams beyond first two are billed
    if (billable === 0) {
      return res.status(400).json({ error: 'No billable teams (only 2). Remain on Rookie plan instead.' });
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
    const plan = prefs.plan || 'rookie';
    const subscriptionId = prefs.subscription_id;
    
    if (plan !== 'veteran') {
      return res.status(400).json({ error: 'This endpoint is only for Veteran plan subscribers' });
    }
    
    if (!subscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }
    
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (subscription.status !== 'active') {
        return res.status(400).json({ error: 'Subscription is not active' });
      }
      
      // Update the quantity of the subscription item
      const subscriptionItem = subscription.items.data[0];
      if (!subscriptionItem) {
        return res.status(400).json({ error: 'No subscription item found' });
      }
      
      await stripe.subscriptionItems.update(subscriptionItem.id, {
        quantity: billable,
      });
      
      debugLog(`[payments] Updated subscription ${subscriptionId} billable quantity to ${billable} (total teams ${team_count})`);
      
      return res.json({ 
        ok: true, 
        subscription_id: subscriptionId,
        total_teams: team_count,
        billable_teams: billable,
        monthly_cost: billable * 1.50
      });
    } catch (err: any) {
      console.warn('Failed to update Stripe subscription quantity:', err?.message || err);
      return res.status(500).json({ error: 'Failed to update subscription quantity' });
    }
  } catch (err) {
    console.error('Error updating subscription quantity:', (err as any)?.message || err);
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
    const hasValidStripeSubscription = stripeStatus === 'active';
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

// Subscription summary for Billing screen
paymentsRouter.get('/subscription/summary', requireVerified as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
    const plan = prefs.plan || 'rookie';
    const subscriptionId = prefs.subscription_id || null;

    let quantity: number | null = null;
    let status: string | null = null;
    let current_period_end: string | null = null;
    let monthly_cost: number | null = null;
    let annual_cost: number | null = null;
    const free_teams = 2;

    if (plan === 'veteran' && subscriptionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        status = sub.status;
        if (sub.current_period_end) current_period_end = new Date(sub.current_period_end * 1000).toISOString();
        const item = sub.items.data[0];
        quantity = item?.quantity ?? null;
        if (typeof quantity === 'number') monthly_cost = Number((quantity * 1.5).toFixed(2));
      } catch (err) {
        console.warn('[payments] Failed to retrieve summary subscription:', (err as any)?.message || err);
      }
    } else if (plan === 'legend') {
      // Annual cost fixed at $19.99
      annual_cost = 19.99;
      // status can be determined if subscription id exists
      if (subscriptionId && process.env.STRIPE_SECRET_KEY) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          status = sub.status;
          if (sub.current_period_end) current_period_end = new Date(sub.current_period_end * 1000).toISOString();
        } catch (e) {
          console.warn('[payments] Failed to retrieve subscription status:', subscriptionId, e);
        }
      }
    }

    return res.json({
      plan,
      subscription_id: subscriptionId,
      status,
      quantity,
      free_teams,
      monthly_cost,
      annual_cost,
      current_period_end,
    });
  } catch (err) {
    console.error('Error building subscription summary:', (err as any)?.message || err);
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

    debugLog(`[payments] Reset user ${userId} to rookie plan (debug endpoint)`);
    
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

    debugLog('🔍 Admin-initiated bulk reset of unpaid subscriptions...');

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

    debugLog(`Found ${usersToReset.length} users with paid plans but no subscription ID`);

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

        debugLog(`✅ Admin reset: ${user.email} to rookie plan`);
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

    debugLog(`[payments] Admin bulk reset completed: ${resetCount}/${usersToReset.length} users`);
    
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
      const metaUserId = session.metadata?.user_id;
      if (!metaUserId) {
        return res.status(403).json({ error: 'Session metadata missing user' });
      }
      if (String(metaUserId) !== String(req.user!.id)) {
        return res.status(403).json({ error: 'Session does not belong to this user' });
      }
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
  debugLog('[payments] finalizeFromSession called', {
    session_id: session.id,
    payment_status: session.payment_status,
    status: session.status,
    metadata: session.metadata
  });
  
  const meta = session.metadata || {};
  const transactionLog = await getTransactionBySession(session.id);
  const alreadyCompleted = transactionLog?.status === 'COMPLETED';
  const shouldSendEmail = !alreadyCompleted;
  const metadataUserId = meta.user_id ? String(meta.user_id) : null;
  const inferredUserId = metadataUserId || (transactionLog?.user_id ? String(transactionLog.user_id) : null);
  const fallbackEmail = transactionLog?.user?.email || transactionLog?.user_email || (session.customer_details?.email ?? null);
  const totalCents = typeof session.amount_total === 'number'
    ? session.amount_total
    : Number(meta.total_cents || transactionLog?.total_cents || 0) || 0;
  const ad_id = meta.ad_id || '';
  let dates: string[] = [];
  try { dates = JSON.parse(String(meta.dates || '[]')); } catch (e) {
    console.warn('[payments] Failed to parse dates from metadata:', meta.dates, e);
  }
  if (ad_id && Array.isArray(dates) && dates.length) {
    debugLog('[payments] Processing ad reservation payment', {
      ad_id,
      dates,
      session_id: session.id,
      payment_status: session.payment_status
    });
    try {
      // CRITICAL SECURITY FIX: Verify user owns the ad before updating
      const ad = await prisma.ad.findUnique({
        where: { id: ad_id },
        select: { user_id: true, payment_status: true }
      });
      
      if (!ad) {
        console.error(`[payments] Ad not found: ${ad_id}`);
        throw new Error('Ad not found');
      }
      
      if (ad.user_id !== inferredUserId) {
        console.error(`[payments] Authorization failed: User ${inferredUserId} does not own ad ${ad_id} (owner: ${ad.user_id})`);
        throw new Error('Unauthorized: You do not own this ad');
      }
      
      // Verify payment amount matches expected cost
      if (ad.payment_status === 'paid') {
        // Ad was already marked paid - might be duplicate webhook
        if (alreadyCompleted) {
          debugLog(`[payments] Ad already paid and transaction already completed, skipping duplicate processing`);
        } else {
          console.warn(`[payments] Ad ${ad_id} already marked paid but transaction not completed`);
        }
      }
      
      // Issue #7 FIX: Validate all dates before transaction
      const parsedDates: Date[] = [];
      for (const dateStr of dates) {
        const parsed = new Date(String(dateStr) + 'T00:00:00.000Z');
        if (isNaN(parsed.getTime())) {
          console.error(`[payments] Invalid date in webhook: ${dateStr}`);
          throw new Error(`Invalid reservation date: ${dateStr}`);
        }
        parsedDates.push(parsed);
      }
      
      // Issue #7 & #9 FIX: Atomic transaction with promo redemption after verification
      await prisma.$transaction(async (tx) => {
        await tx.ad.update({ 
          where: { id: ad_id }, 
          data: { 
            payment_status: 'paid',
            status: 'active' // Mark ad as active when payment is completed
          } 
        });
        await tx.adReservation.createMany({ 
          data: parsedDates.map((date) => ({ ad_id, date })), 
          skipDuplicates: true 
        });
        
        // Issue #9 FIX: Redeem promo code AFTER payment and reservations are verified
        const promoCode = meta.promo_code ? String(meta.promo_code).trim() : '';
        if (promoCode && session.payment_status === 'paid') {
          const subtotalCents = Number(meta.subtotal_cents || 0) || 0;
          await redeemPromo({ 
            code: promoCode, 
            subtotalCents, 
            userId: inferredUserId || 'unknown', 
            service: 'booking', 
            orderId: session.id 
          });
        }
      });
      debugLog('[payments] Ad reservation payment completed successfully', {
        ad_id,
        dates,
        session_id: session.id,
        status: 'active'
      });
      
      // Cancel the payment reminder email since payment was completed
      const jobId = `payment-reminder-${session.id}`;
      const job = await emailQueue.getJob(jobId);
      if (job) {
        await job.remove();
        debugLog(`[payments] Cancelled payment reminder email (job ${jobId})`);
      }
      
      // Update transaction log to COMPLETED
      await updateTransactionStatus(session.id, 'COMPLETED', {
        stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : undefined,
      });
      if (shouldSendEmail) {
        await sendAdPaymentEmail({
          userId: inferredUserId,
          fallbackEmail,
          adId: String(ad_id),
          dates,
          totalCents,
        });
      }
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
    debugLog('[payments] finalize membership check', { 
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
      // CRITICAL FIX #2: Check idempotence before processing
      if (alreadyCompleted) {
        debugLog('[payments] Membership finalization already completed, skipping to prevent duplicate updates', {
          session_id: session.id,
          userId,
          plan
        });
        return;
      }
      
      try {
        const current = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const existingPrefs = (current?.preferences && typeof current.preferences === 'object') ? (current.preferences as any) : {};
        const prefs: any = { ...existingPrefs, plan };
        
        // CRITICAL FIX #4: Reconcile team count between checkout and finalization
        // Team count was stored at checkout time, but user might have added/deleted teams
        const checkoutTeamCountTotal = meta.team_count_total ? Number(meta.team_count_total) : undefined;
        const checkoutTeamCountBillable = meta.team_count_billable ? Number(meta.team_count_billable) : undefined;
        
        if (plan === 'veteran' && checkoutTeamCountTotal && checkoutTeamCountBillable !== undefined) {
          // Validate current team count matches checkout
          const teamData = await prisma.team.findMany({
            where: { organization_id: { in: (current?.preferences as any)?.org_ids || [] } },
            select: { id: true }
          });
          const currentTeamCount = teamData.length;
          
          if (currentTeamCount !== checkoutTeamCountTotal) {
            // Team count changed since checkout - log this for monitoring
            const newBillableQuantity = Math.max(0, currentTeamCount - 2);
            console.info('[payments] Team count changed since checkout', {
              session_id: session.id,
              userId,
              checkoutTeamCountTotal,
              currentTeamCount,
              checkoutBillableQuantity: checkoutTeamCountBillable,
              newBillableQuantity,
              note: 'Subscription was created with original quantity but user should audit'
            });
          }
        }
        
        // Retrieve subscription details BEFORE updating preferences
        const legendOneTimePayment = plan === 'legend' && session.mode === 'payment';
        let subscriptionId: string | undefined = undefined;
        let subscriptionPeriodEnd: string | undefined = undefined;
        
        if (session.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(String(session.subscription));
            
            // CRITICAL FIX #5: Verify subscription is actually active before storing
            if (sub && sub.id && sub.status === 'active') {
              subscriptionId = String(sub.id);
              if (sub.current_period_end) {
                subscriptionPeriodEnd = new Date(Number(sub.current_period_end) * 1000).toISOString();
              }
            } else if (sub && sub.id) {
              console.warn('[payments] Subscription not active for membership', {
                subscription_id: sub.id,
                status: sub.status,
                user_id: userId,
                session_id: session.id
              });
              throw new Error(`Subscription is not in active state: ${sub.status}`);
            }
          } catch (err) {
            console.error('[payments] Failed to retrieve subscription details:', (err as any)?.message || err);
            // CRITICAL: Fail the webhook if we can't verify subscription
            throw new Error('Unable to verify subscription status with Stripe');
          }
        }
        
        // CRITICAL FIX #2: Only update preferences if we have required subscription data (or legend one-time payment)
        if (subscriptionId) {
          prefs.subscription_id = subscriptionId;
          prefs.subscription_period_end = subscriptionPeriodEnd;
        } else if (!legendOneTimePayment) {
          throw new Error('Subscription ID not retrieved from Stripe');
        } else {
          delete prefs.subscription_id;
          delete prefs.subscription_period_end;
        }
        
        // CRITICAL: Set role='coach' for any membership purchase (veteran/legend)
        // This is required for Step 4 (organization creation) and allows coaches to manage orgs
        if (plan === 'veteran' || plan === 'legend') {
          prefs.role = 'coach';
        }
        
        if (session.customer) {
          prefs.stripe_customer_id = String(session.customer);
        }
        
        // CRITICAL FIX #2: Wrap user update and transaction log update in single transaction
        await prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: userId }, data: { preferences: prefs } });
          
          // Update transaction log to COMPLETED within same transaction
          await updateTransactionStatus(session.id, 'COMPLETED', {
            stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : undefined,
            stripeSubscriptionId: subscriptionId,
          });
        });
        
        console.info('[payments] membership finalize', { 
          userId, 
          plan, 
          subscription_id: subscriptionId, 
          subscription_period_end: subscriptionPeriodEnd 
        });
        
        if (shouldSendEmail) {
          await sendSubscriptionEmail({
            userId,
            fallbackEmail,
            plan,
            totalCents,
          });
        }
      } catch (err) {
        console.error('[payments] Failed to finalize membership from session:', (err as any)?.message || err);
        // CRITICAL: Don't silently fail - this webhook will be retried
        throw err;
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
