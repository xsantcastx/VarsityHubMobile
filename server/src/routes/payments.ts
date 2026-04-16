import crypto from 'crypto';
import expressPkg, { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { debugLog } from '../lib/debugLog.js';
import { withDistributedLock } from '../lib/distributedLock.js';
import { sendBillingNoticeEmail } from '../lib/email.js';
import { getAllPlanDefinitions, getMaxTeamsForPlan } from '../lib/planLimits.js';
import { prisma } from '../lib/prisma.js';
import { previewPromo, redeemPromo } from '../lib/promos.js';
import { captureException } from '../lib/sentry.js';
import { calculateSalesTax } from '../lib/taxCalculator.js';
import { calculateStripeFee, getTransactionBySession, logTransaction, updateTransactionStatus } from '../lib/transactionLogger.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { paymentLimiter } from '../middleware/rateLimiters.js';
import { calculateAdPriceCents } from '../utils/adPricing.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

if (process.env.NODE_ENV === 'production' && !process.env.STRIPE_SECRET_KEY) {
  throw new Error('FATAL: STRIPE_SECRET_KEY must be set in production. Server cannot start without payment processing.');
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('[payments] STRIPE_SECRET_KEY is not set — payment features will fail');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_not_configured', { apiVersion: '2024-06-20' });

// Startup warnings for critical payment config
if (process.env.NODE_ENV === 'production') {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[payments] FATAL: STRIPE_WEBHOOK_SECRET is not set in production — webhooks will fail silently. Server cannot start.');
    process.exit(1);
  }
  if (!process.env.APPLE_IAP_SHARED_SECRET) console.warn('[payments] Apple IAP shared secret not set — iOS IAP verification disabled');
} else {
  if (!process.env.STRIPE_WEBHOOK_SECRET) console.warn('[payments] WARNING: STRIPE_WEBHOOK_SECRET is not set in development — webhooks will fail silently');
}

// Admin notification email — first entry from ADMIN_EMAILS env var
const ADMIN_NOTIFY_EMAIL = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)[0] || '';

export const paymentsRouter = Router();

// Public config for coach onboarding and payment UI (no auth required)
paymentsRouter.get('/config', (_req, res) => {
  const stripePublishableKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    '';
  const availablePlans = getAllPlanDefinitions();
  const stripeConfigured = !!(
    stripePublishableKey &&
    process.env.STRIPE_SECRET_KEY
  );
  if (!stripeConfigured) {
    return res.status(503).json({ error: 'Payment system not configured', payments_enabled: false });
  }
  res.json({
    stripe_publishable_key: stripePublishableKey,
    available_plans: availablePlans,
    payments_enabled: true,
  });
});

const formatUsd = (cents?: number | null) => {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return '';
  return `$${(cents / 100).toFixed(2)}`;
};

async function getUserEmail(userId?: string | null, fallbackEmail?: string | null) {
  if (fallbackEmail && fallbackEmail.includes('@')) return fallbackEmail;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: String(userId) }, select: { email: true } });
  return user?.email || null;
}

// Ad payment email notification removed — non-mandatory transactional email

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
  const perks = plan === 'veteran'
    ? ['Add unlimited teams beyond the first two', 'Priority scheduling support']
    : plan === 'legend'
      ? ['Unlimited teams included', 'Annual discounted pricing']
      : ['Premium access activated'];
  try {
    await sendBillingNoticeEmail({
      to: email,
      type: 'payment_succeeded',
      planName,
      amount: formatUsd(totalCents),
      perks,
    });
  } catch (err) {
    console.warn('[payments] Unable to send subscription email:', (err as any)?.message || err);
  }
}

// Ad pricing now uses the shared helper from utils/adPricing.ts
// This ensures consistent pricing calculation ($5 weekday, $8 weekend per week block)
// and proper week-block grouping (multiple dates in same week = single charge)

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

async function createMembershipCheckoutSession(req: AuthedRequest, planValue: unknown, promoCode?: string, teamCount?: number, organizationId?: string) {
  if (!process.env.STRIPE_SECRET_KEY) throw membershipError(500, 'Stripe not configured');
  if (typeof planValue !== 'string' || !planValue.trim()) throw membershipError(400, 'plan is required');
  const raw = planValue.trim().toLowerCase();
  if (raw !== 'veteran' && raw !== 'legend') throw membershipError(400, 'Invalid plan for subscription');
  const chosen = raw as MembershipPlan;

  // Verify org ownership if organization_id provided
  if (organizationId) {
    const orgMembership = await prisma.organizationMembership.findUnique({
      where: { organization_id_user_id: { organization_id: organizationId, user_id: req.user!.id } },
    });
    if (!orgMembership || orgMembership.role !== 'owner') {
      throw membershipError(403, 'Only the organization owner can purchase a subscription for the organization');
    }
  }

  // Validate team count for Veteran plan (total teams including the first two free)
  if (chosen === 'veteran') {
    if (typeof teamCount !== 'number' || teamCount < 3) {
      throw membershipError(400, 'Veteran plan requires at least 3 total teams (first 2 are free)');
    }
    // Verify the claimed team count matches actual count — org teams if org provided, else user-owned
    const actualTeamCount = organizationId
      ? await prisma.team.count({ where: { organization_id: organizationId } })
      : await prisma.teamMembership.count({
          where: { user_id: req.user!.id, role: 'owner', status: 'active' },
        });
    if (teamCount > actualTeamCount) {
      throw membershipError(400, `Team count mismatch: ${organizationId ? 'organization has' : 'you own'} ${actualTeamCount} teams but requested billing for ${teamCount}`);
    }
  }

  // Check if user already has this exact paid plan (allow upgrades from rookie)
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, approval_status: true } });
  const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};

  // Block checkout if coach hasn't been approved yet
  if (prefs.role === 'coach' && user?.approval_status !== 'APPROVED') {
    throw membershipError(403, 'Your league must be approved before you can subscribe.');
  }
  const currentPlan = prefs.plan || 'rookie'; // Default to rookie if no plan set
  
  // Only block if user already has the exact same paid plan they're trying to purchase
  // Allow upgrades from rookie to veteran/legend, and between veteran/legend
  if (currentPlan === chosen) {
    throw membershipError(400, 'You already have this subscription plan');
  }

  debugLog(`[payments] Plan upgrade: ${currentPlan} → ${chosen} for user ${userId}`);

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
      debugLog('[payments] Recent PAID session found, updating user preferences from Stripe session');
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

  // Calculate billable quantity for Veteran plan (only teams beyond the first two are billed)
  const billableQuantity = chosen === 'veteran' && typeof teamCount === 'number' ? Math.max(0, teamCount - 2) : 1;
  // If user selected only 2 or fewer teams, they should remain on Rookie (defensive check)
  if (chosen === 'veteran' && billableQuantity === 0) {
    throw membershipError(400, 'Select at least one billable team (3 total) to use Veteran plan');
  }

  if (!hasExplicitPriceId && process.env.NODE_ENV === 'production') {
    throw membershipError(500, `Stripe price ID not configured for ${chosen} plan. Set STRIPE_PRICE_${chosen.toUpperCase()} env var.`);
  }

  const lineItems = hasExplicitPriceId
    ? [{ price: normalizedPriceId, quantity: chosen === 'veteran' ? billableQuantity : 1 }]
    : [{
        quantity: chosen === 'veteran' ? billableQuantity : 1,
        price_data: {
          currency: 'usd',
          unit_amount: chosen === 'veteran' ? 99 : 2999, // Veteran: $0.99/month per additional team, Legend: $29.99/year
          recurring: { interval: chosen === 'veteran' ? 'month' : 'year' },
          product_data: {
            name: 'Membership - ' + chosen,
            description: chosen === 'veteran'
              ? `Veteran plan - $0.99/month per additional team (${billableQuantity} billable of ${teamCount} total, 2 free)`
              : 'Legend plan - $29.99/year unlimited',
          },
        },
      }];

  const appBase = process.env.APP_BASE_URL || process.env.EXPO_PUBLIC_API_URL;
  if (!appBase && process.env.NODE_ENV === 'production') {
    throw membershipError(500, 'APP_BASE_URL must be set in production');
  }
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
      team_count_total: chosen === 'veteran' && teamCount ? String(teamCount) : '',
      team_count_billable: chosen === 'veteran' ? String(billableQuantity) : '',
      organization_id: organizationId || '',
    },
  };

  // Apply promo code if provided (Stripe coupon/promotion code)
  if (promoCode && typeof promoCode === 'string' && promoCode.trim()) {
    try {
      // Stripe accepts promotion codes directly in checkout sessions
      sessionConfig.discounts = [{
        promotion_code: promoCode.trim(),
      }];
      debugLog(`[payments] Applying promo code to subscription: ${promoCode.trim()}`);
    } catch (promoErr) {
      console.warn('[payments] Failed to apply promo code:', promoErr);
      // Continue without promo code rather than failing
    }
  }

  // Store old subscription ID for cancellation AFTER new payment completes (in webhook/finalizeFromSession)
  // Do NOT cancel here — if user abandons checkout, they'd lose their current subscription
  const existingSubId = prefs.subscription_id;
  if (existingSubId && currentPlan !== 'rookie') {
    debugLog(`[payments] User has existing subscription ${existingSubId} — will cancel after new payment completes`);
  }

  // v1.0.2 audit fix: idempotency key was drifting every 60s via Math.floor(Date.now()/60000).
  // Network retries past the minute boundary created duplicate Stripe sessions → duplicate charges.
  // Now prefer client-supplied x-idempotency-key; fall back to a 1-hour window that still provides
  // meaningful retry protection without blocking legitimate new upgrades.
  const clientKey = (req.headers['x-idempotency-key'] as string) || '';
  if (!clientKey && process.env.NODE_ENV !== 'production') {
    console.warn('[payments] No x-idempotency-key header on /payments/checkout — using 1h fallback window. Client should supply a UUID per checkout attempt.');
  }
  const idempotencyKey = clientKey || `membership_${req.user!.id}_${chosen}_${Math.floor(Date.now() / (60 * 60 * 1000))}`;
  const session = await stripe.checkout.sessions.create(sessionConfig, { idempotencyKey });

  // Log subscription transaction
  const currentUser = await prisma.user.findUnique({ 
    where: { id: req.user!.id },
    select: { email: true }
  });
  const amount = chosen === 'veteran' ? 99 * billableQuantity : 2999; // Veteran: $0.99/month per additional team, Legend: $29.99/year
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
      team_count_total: chosen === 'veteran' ? teamCount : undefined,
      team_count_billable: chosen === 'veteran' ? billableQuantity : undefined,
      organization_id: organizationId || undefined,
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return { url: session.url ?? null, sessionId: session.id };
}

// Create a Stripe Checkout Session for ad reservations
paymentsRouter.post('/checkout', expressPkg.json(), requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });
  const checkoutSchema = z.object({
    ad_id: z.string().optional(),
    dates: z.array(z.string()).optional(),
    promo_code: z.string().optional(),
    plan: z.string().optional(),
    team_count: z.number().optional(),
    organization_id: z.string().optional(),
  });
  const parsed = checkoutSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
  const { ad_id, dates, promo_code, plan, team_count, organization_id } = parsed.data;
  if (typeof plan === 'string' && plan.trim()) {
    try {
      const { url, sessionId } = await createMembershipCheckoutSession(req, plan, promo_code, team_count, organization_id);
      return res.json({ url, session_id: sessionId });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      captureException(err, { context: 'stripe_checkout_error', plan });
      return res.status(status).json({ error: err?.message || 'Unable to start subscription checkout' });
    }
  }
  if (!ad_id || !Array.isArray(dates) || dates.length === 0) return res.status(400).json({ error: 'ad_id and dates[] are required' });
  const isoDates: string[] = Array.from(new Set(dates.map((d: any) => String(d))));

  // Enforce booking horizon — no dates beyond 56 days from today
  const MAX_BOOKING_HORIZON_DAYS = 56;
  const horizonCutoff = new Date();
  horizonCutoff.setDate(horizonCutoff.getDate() + MAX_BOOKING_HORIZON_DAYS);
  const pastHorizon = isoDates.filter(d => new Date(d + 'T00:00:00.000Z') > horizonCutoff);
  if (pastHorizon.length > 0) {
    return res.status(400).json({ error: `Dates must be within ${MAX_BOOKING_HORIZON_DAYS} days from today`, dates: pastHorizon });
  }

  // Ensure ad exists and belongs to the requesting user
  const ad = await prisma.ad.findUnique({ where: { id: String(ad_id) } });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });
  if (ad.user_id !== req.user?.id) return res.status(403).json({ error: 'You can only pay for your own ads' });

  // No charge until approved — match PaymentSheet route behavior
  if (ad.status !== 'approved' && ad.status !== 'active') {
    return res.status(403).json({
      error: 'APPROVAL_REQUIRED',
      message: 'Your ad must be approved before payment. An admin will review it and notify you when you can pay.',
    });
  }

  // Slot availability check — reject before Stripe if any date is already full.
  // Up to MAX_AD_SLOTS different ads may run per date per zip.
  const MAX_AD_SLOTS = 2;
  if (ad.target_zip_code) {
    // Include paid, hold, and pending_approval — align with PaymentSheet to prevent overfilling zip
    const reservedAdsInZip = await prisma.ad.findMany({
      where: { target_zip_code: ad.target_zip_code, payment_status: { in: ['paid', 'hold', 'pending_approval'] }, NOT: { id: String(ad_id) } },
      select: { id: true },
      take: 100,
    });
    if (reservedAdsInZip.length > 0) {
      const dateObjects = isoDates.map((s) => new Date(s + 'T00:00:00.000Z'));
      const bookedSlots = await prisma.adReservation.groupBy({
        by: ['date'],
        where: { ad_id: { in: reservedAdsInZip.map((a) => a.id) }, date: { in: dateObjects } },
        _count: { date: true },
      });
      const fullDates = bookedSlots.filter((s) => s._count.date >= MAX_AD_SLOTS);
      if (fullDates.length > 0) {
        return res.status(409).json({
          error: 'One or more selected dates are fully booked',
          dates: fullDates.map((s) => s.date.toISOString().slice(0, 10)),
        });
      }
    }
  }

  // Use shared ad pricing helper for consistent calculation
  // Groups dates into week blocks: $5/week for Mon-Thu, $8/week for Fri-Sun
  const pricingResult = calculateAdPriceCents(isoDates);
  const subtotal = pricingResult.totalCents;
  if (subtotal <= 0) return res.status(400).json({ error: 'Invalid amount' });

  // Calculate sales tax based on ad's target zip code
  const taxCents = ad.target_zip_code ? calculateSalesTax(subtotal, ad.target_zip_code) : 0;
  
  // Calculate total before discount
  const subtotalWithTax = subtotal + taxCents;

  // Apply promo code if provided (discount applies to subtotal, not tax)
  let discount = 0;
  let appliedCode: string | null = null;
  if (promo_code && typeof promo_code === 'string') {
    const preview = await previewPromo({ code: promo_code, subtotalCents: subtotal, userId: req.user!.id, service: 'booking' });
    if (!preview.valid) return res.status(400).json({ error: preview.reason });
    discount = preview.discount_cents;
    appliedCode = preview.code;
  }

  // Total = (subtotal - discount) + tax
  const total = Math.max(0, subtotal - discount + taxCents);
  // If promo covers 100% of the base price, treat as free (absorb tax on complimentary orders)
  const isFullyComped = discount >= subtotal;
  if (total === 0 || isFullyComped) {
    // Record redemption and create reservations
    if (appliedCode) {
      await redeemPromo({ code: appliedCode, subtotalCents: subtotal, userId: req.user!.id, service: 'booking', orderId: `FREE-${crypto.randomUUID()}` });
    }
    try {
      await prisma.$transaction([
        prisma.ad.update({ where: { id: String(ad_id) }, data: { payment_status: 'paid', status: 'active' } }),
        prisma.adReservation.createMany({ data: isoDates.map((s) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })), skipDuplicates: true }),
      ]);
    } catch (e) {
      console.error('Failed to create ad reservations for free promo:', e);
      return res.status(500).json({ error: 'Failed to reserve ad dates. Please try again.' });
    }
    // v1.0.2 audit fix: await so financial audit trail can't silently drop.
    // On DB failure, the user-facing response succeeds but we capture to Sentry at error level.
    try {
      await logTransaction({
        transactionType: 'AD_PURCHASE',
        status: 'COMPLETED',
        userId: req.user!.id,
        subtotalCents: subtotal,
        taxCents: 0,
        discountCents: discount,
        promoCode: appliedCode || undefined,
        promoDiscountCents: discount,
        totalCents: 0,
        netCents: 0,
        currency: 'usd',
        metadata: { free_promo: true, ad_id: String(ad_id), dates: isoDates },
      });
    } catch (err) {
      console.error('[payments] Failed to log free promo transaction:', err);
      captureException(err as Error, { context: 'free_promo_transaction_log', adId: String(ad_id) });
    }
    // Ad payment confirmation email removed — non-mandatory
    return res.json({ free: true });
  }

  // Use deep links for mobile app redirects
  const appScheme = 'varsityhubmobile';
  const success = `${appScheme}://payment-success?session_id={CHECKOUT_SESSION_ID}&type=ad`;
  const cancel = `${appScheme}://payment-cancel?type=ad`;

  // Check if Stripe Price IDs are configured for ads (optional, fallback to price_data)
  const weekdayPriceId = process.env.STRIPE_PRICE_AD_WEEKDAY?.trim() || '';
  const weekendPriceId = process.env.STRIPE_PRICE_AD_WEEKEND?.trim() || '';
  const hasPriceIds = weekdayPriceId && weekendPriceId && 
                      /^price_/.test(weekdayPriceId) && /^price_/.test(weekendPriceId);

  // CRITICAL: When using Price IDs, Stripe doesn't automatically add tax/discount
  // If tax or discount exists, we must use price_data to include them in the total
  // Otherwise we'd underbill by charging only base price without tax/discount
  const hasTaxOrDiscount = taxCents > 0 || discount > 0;

  // Build human-readable date range description (e.g. "Ad Reservation — Feb 27 - Mar 12, 2026 (7 days)")
  const _sd = [...isoDates].sort();
  const _d0 = new Date(_sd[0] + 'T12:00:00Z');
  const _d1 = new Date(_sd[_sd.length - 1] + 'T12:00:00Z');
  const _fmt = (d: Date, yr: boolean) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(yr ? { year: 'numeric' } : {}) });
  const adDateDesc = `Ad Reservation — ${_fmt(_d0, false)} - ${_fmt(_d1, true)} (${isoDates.length} day${isoDates.length !== 1 ? 's' : ''})`;

  let lineItems: any[] = [];

  if (hasPriceIds && !hasTaxOrDiscount) {
    // Use Stripe Price IDs when available AND no tax/discount (can't add tax/discount to Price IDs easily)
    debugLog('[payments] Using Stripe Price IDs for ad checkout', {
      weekdayBlocks: pricingResult.weekdayBlocks,
      weekendBlocks: pricingResult.weekendBlocks,
      tax: taxCents,
      discount,
    });
    lineItems = [
      ...(pricingResult.weekdayBlocks > 0 ? [{
        price: weekdayPriceId,
        quantity: pricingResult.weekdayBlocks,
      }] : []),
      ...(pricingResult.weekendBlocks > 0 ? [{
        price: weekendPriceId,
        quantity: pricingResult.weekendBlocks,
      }] : []),
    ];

    // If no blocks selected (shouldn't happen, but defensive), fall back to price_data
    if (lineItems.length === 0) {
      debugLog('[payments] No blocks found, falling back to price_data');
      lineItems = [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: total,
          product_data: {
            name: 'Ad Reservation',
            description: adDateDesc,
          },
        },
      }];
    }
  } else {
    // Use dynamic price_data when:
    // - Price IDs not configured, OR
    // - Tax or discount exists (Price IDs can't easily include tax/discount)
    if (hasTaxOrDiscount && hasPriceIds) {
      debugLog('[payments] Tax/discount detected - using price_data instead of Price IDs to include tax/discount in total', {
        tax: taxCents,
        discount,
        total,
        subtotal,
      });
    } else {
      debugLog('[payments] Using dynamic price_data for ad checkout (Price IDs not configured)');
    }
    
    lineItems = [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: total, // Total includes tax and discount already calculated
        product_data: {
          name: 'Ad Reservation',
          description: `${adDateDesc}${discount > 0 ? ` (${formatUsd(discount)} discount applied)` : ''}${taxCents > 0 ? ` + ${formatUsd(taxCents)} tax` : ''}`,
        },
      },
    }];
  }

  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    success_url: success,
    cancel_url: cancel,
    line_items: lineItems as any,
    // Useful metadata for webhook
    metadata: {
      ad_id: String(ad_id),
      dates: JSON.stringify(isoDates),
      user_id: req.user!.id,
      subtotal_cents: String(subtotal),
      tax_cents: String(taxCents),
      promo_code: appliedCode || '',
      discount_cents: String(discount || 0),
      weekday_blocks: String(pricingResult.weekdayBlocks),
      weekend_blocks: String(pricingResult.weekendBlocks),
    },
  };

  // If using Price IDs and there's a tax, we can't easily add it to Price ID line items
  // Stripe's automatic_tax feature could be used if enabled, but for now we fall back to price_data
  // This is already handled above (hasTaxOrDiscount check)
  
  // Note: If Stripe automatic tax is enabled in your Stripe account, you could set:
  // sessionConfig.automatic_tax = { enabled: true };
  // This would calculate and add tax automatically for Price IDs

  // v1.0.2 audit fix: same idempotency drift bug — widen fallback window to 1h.
  const adIdemClientKey = (req.headers['x-idempotency-key'] as string) || '';
  const adIdempotencyKey = adIdemClientKey || `ad_${req.user!.id}_${ad_id}_${Math.floor(Date.now() / (60 * 60 * 1000))}`;
  const session = await stripe.checkout.sessions.create(sessionConfig, { idempotencyKey: adIdempotencyKey });

  // Hold slots: create temporary reservations + mark ad as 'hold' so other checkouts see them.
  // On payment success, status moves to 'paid'. On failure/expiry, hold is released.
  try {
    await prisma.$transaction([
      prisma.ad.update({ where: { id: String(ad_id) }, data: { payment_status: 'hold' } }),
      prisma.adReservation.createMany({
        data: isoDates.map((s) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })),
        skipDuplicates: true,
      }),
    ]);
  } catch (holdErr) {
    console.error('[payments] Failed to create slot hold — aborting checkout:', (holdErr as any)?.message);
    captureException(holdErr as Error, { context: 'ad_slot_hold_failed', adId: String(ad_id), userId: req.user!.id });
    return res.status(500).json({ error: 'Failed to reserve ad slot. Please try again.' });
  }

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

  return res.json({ url: session.url });
}));

// ── In-App PaymentSheet endpoint ────────────────────────────────────────────
// Returns client_secret, ephemeral key, customer id and publishable key
// so the mobile app can present Stripe PaymentSheet without leaving the app.
paymentsRouter.post('/create-payment-sheet', expressPkg.json(), requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '';
  const userId = req.user!.id;
  const paymentSheetSchema = z.object({
    ad_id: z.string().optional(),
    dates: z.array(z.string()).optional(),
    promo_code: z.string().optional(),
    plan: z.string().optional(),
    team_count: z.number().optional(),
    organization_id: z.string().optional(),
  });
  const parsed = paymentSheetSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
  const { ad_id, dates, promo_code, plan, team_count, organization_id: orgIdBody } = parsed.data;

  // ── Get or create Stripe Customer (race-safe) ──
  // Re-check inside a serializable transaction to prevent two requests from creating
  // duplicate Stripe customers for the same user.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, stripe_customer_id: true, preferences: true } });
  let customerId = user?.stripe_customer_id;
  if (!customerId) {
    // Use transaction to atomically check-and-set
    customerId = await prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: userId }, select: { stripe_customer_id: true } });
      if (fresh?.stripe_customer_id) return fresh.stripe_customer_id;
      // No customer yet — create one in Stripe and save atomically
      const customer = await stripe.customers.create({ email: user?.email || undefined, metadata: { user_id: userId } });
      await tx.user.update({ where: { id: userId }, data: { stripe_customer_id: customer.id } });
      return customer.id;
    }, { isolationLevel: 'Serializable' });
  }

  // Create ephemeral key
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2024-06-20' }
  );

  // ── SUBSCRIPTION FLOW ──
  if (typeof plan === 'string' && plan.trim()) {
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};

    // Rule A: Fall back to pending_plan if plan param matches it, or use pending_plan directly
    const raw = plan.trim().toLowerCase();
    const resolvedPlan = (raw === 'veteran' || raw === 'legend') ? raw : (prefs.pending_plan || '').toLowerCase();
    if (resolvedPlan !== 'veteran' && resolvedPlan !== 'legend') return res.status(400).json({ error: 'Invalid plan for subscription' });
    const chosen = resolvedPlan as MembershipPlan;

    // Verify org ownership if organization_id provided
    if (orgIdBody) {
      const orgMem = await prisma.organizationMembership.findUnique({
        where: { organization_id_user_id: { organization_id: orgIdBody, user_id: userId } },
      });
      if (!orgMem || orgMem.role !== 'owner') {
        return res.status(403).json({ error: 'Only the organization owner can purchase a subscription for the organization' });
      }
    }

    // Rule A: Block checkout if coach hasn't been approved yet
    const approvalCheck = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { approval_status: true } });
    if (prefs.role === 'coach' && approvalCheck?.approval_status !== 'APPROVED') {
      return res.status(403).json({
        error: 'APPROVAL_REQUIRED',
        message: 'Your league must be approved before you can subscribe.'
      });
    }

    // Validate team count for Veteran plan (fall back to stored value)
    const effectiveTeamCount = typeof team_count === 'number' ? team_count : Number(prefs.team_count_total) || 0;
    if (chosen === 'veteran') {
      if (effectiveTeamCount < 3) {
        return res.status(400).json({ error: 'Veteran plan requires at least 3 total teams (first 2 are free)' });
      }
      // Verify the claimed team count — org teams if org provided, else user-owned
      const actualTeamCount = orgIdBody
        ? await prisma.team.count({ where: { organization_id: orgIdBody } })
        : await prisma.teamMembership.count({
            where: { user_id: userId, role: 'owner', status: 'active' },
          });
      if (effectiveTeamCount > actualTeamCount) {
        return res.status(400).json({ error: `Team count mismatch: ${orgIdBody ? 'organization has' : 'you own'} ${actualTeamCount} teams but requested billing for ${effectiveTeamCount}` });
      }
    }

    // Check if user already has this plan (check active plan, not pending_plan)
    const currentPlan = prefs.plan || 'rookie';
    if (currentPlan === chosen) return res.status(400).json({ error: 'You already have this subscription plan' });

    const billableQuantity = chosen === 'veteran' ? Math.max(0, effectiveTeamCount - 2) : 1;
    if (chosen === 'veteran' && billableQuantity === 0) {
      return res.status(400).json({ error: 'Select at least one billable team (3 total) to use Veteran plan' });
    }

    // Build price / line items
    const priceIdRaw = membershipPriceIds[chosen];
    const normalizedPriceId = typeof priceIdRaw === 'string' ? priceIdRaw.trim() : '';
    const hasExplicitPriceId = /^price_/i.test(normalizedPriceId) && !['price_xxx', 'price_yyy', 'your_price_id'].some((h) => normalizedPriceId.toLowerCase().includes(h));

    if (!hasExplicitPriceId && process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: `Stripe price ID not configured for ${chosen} plan. Set STRIPE_PRICE_${chosen.toUpperCase()} env var.` });
    }

    const items = hasExplicitPriceId
      ? [{ price: normalizedPriceId, quantity: chosen === 'veteran' ? billableQuantity : 1 }]
      : [{
          quantity: chosen === 'veteran' ? billableQuantity : 1,
          price_data: {
            currency: 'usd',
            unit_amount: chosen === 'veteran' ? 99 : 2999,
            recurring: { interval: chosen === 'veteran' ? ('month' as const) : ('year' as const) },
            product_data: {
              name: 'Membership - ' + chosen,
              description: chosen === 'veteran'
                ? `Veteran plan - $0.99/month per additional team (${billableQuantity} billable of ${effectiveTeamCount} total, 2 free)`
                : 'Legend plan - $29.99/year unlimited',
            },
          },
        }];

    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: items as any,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          membership: '1',
          plan: chosen,
          user_id: userId,
          promo_code: promo_code || '',
          team_count_total: chosen === 'veteran' && effectiveTeamCount ? String(effectiveTeamCount) : '',
          team_count_billable: chosen === 'veteran' ? String(billableQuantity) : '',
          organization_id: orgIdBody || '',
        },
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice | null;
      const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | null;
      if (!invoice || !paymentIntent) {
        return res.status(500).json({ error: 'Subscription created but payment could not be initialized. Please contact support.' });
      }

      // Log transaction (must match actual Stripe charge: $0.99/team veteran, $29.99/year legend)
      const amount = chosen === 'veteran' ? 99 * billableQuantity : 2999;
      await logTransaction({
        transactionType: 'SUBSCRIPTION_PURCHASE',
        status: 'PENDING',
        stripeSessionId: subscription.id,
        userId,
        userEmail: user?.email || 'unknown',
        subtotalCents: amount,
        taxCents: 0,
        stripeFeeeCents: calculateStripeFee(amount),
        discountCents: 0,
        totalCents: amount,
        promoCode: promo_code || undefined,
        metadata: { plan: chosen, team_count_total: chosen === 'veteran' ? team_count : undefined, team_count_billable: chosen === 'veteran' ? billableQuantity : undefined },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.json({
        paymentIntent: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        publishableKey,
        subscriptionId: subscription.id,
      });
    } catch (err: any) {
      captureException(err, { context: 'create_payment_sheet_subscription', plan: chosen });
      const raw = err?.message || '';
      const safeMsg = /prod_|price_/i.test(raw) ? 'Unable to start subscription. Please try again or contact support.' : (raw || 'Unable to start subscription');
      return res.status(500).json({ error: safeMsg });
    }
  }

  // ── AD PAYMENT FLOW ──
  if (!ad_id || !Array.isArray(dates) || dates.length === 0) return res.status(400).json({ error: 'ad_id and dates[] are required (or plan for subscription)' });
  const isoDates: string[] = Array.from(new Set(dates.map((d: any) => String(d))));

  // Enforce booking horizon — no dates beyond 56 days from today
  const MAX_BOOKING_HORIZON_DAYS = 56;
  const horizonCutoff = new Date();
  horizonCutoff.setDate(horizonCutoff.getDate() + MAX_BOOKING_HORIZON_DAYS);
  const pastHorizon = isoDates.filter(d => new Date(d + 'T00:00:00.000Z') > horizonCutoff);
  if (pastHorizon.length > 0) {
    return res.status(400).json({ error: `Dates must be within ${MAX_BOOKING_HORIZON_DAYS} days from today`, dates: pastHorizon });
  }

  const ad = await prisma.ad.findUnique({ where: { id: String(ad_id) } });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });
  if (ad.user_id !== req.user?.id) return res.status(403).json({ error: 'You can only pay for your own ads' });

  // No charge until approved by emancero@varsityhub.app. Once approved, no re-approval needed for future runs.
  if (ad.status !== 'approved' && ad.status !== 'active') {
    return res.status(403).json({
      error: 'APPROVAL_REQUIRED',
      message: 'Your ad must be approved before payment. An admin will review it and notify you when you can pay.',
    });
  }

  // Slot availability check — include 'hold' and 'pending_approval' ads
  const MAX_AD_SLOTS = 2;
  if (ad.target_zip_code) {
    const reservedAdsInZip = await prisma.ad.findMany({
      where: { target_zip_code: ad.target_zip_code, payment_status: { in: ['paid', 'hold', 'pending_approval'] }, NOT: { id: String(ad_id) } },
      select: { id: true },
      take: 100,
    });
    if (reservedAdsInZip.length > 0) {
      const dateObjects = isoDates.map((s) => new Date(s + 'T00:00:00.000Z'));
      const bookedSlots = await prisma.adReservation.groupBy({
        by: ['date'],
        where: { ad_id: { in: reservedAdsInZip.map((a) => a.id) }, date: { in: dateObjects } },
        _count: { date: true },
      });
      const fullDates = bookedSlots.filter((s) => s._count.date >= MAX_AD_SLOTS);
      if (fullDates.length > 0) {
        return res.status(409).json({ error: 'One or more selected dates are fully booked', dates: fullDates.map((s) => s.date.toISOString().slice(0, 10)) });
      }
    }
  }

  const pricingResult = calculateAdPriceCents(isoDates);
  const subtotal = pricingResult.totalCents;
  if (subtotal <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const taxCents = ad.target_zip_code ? calculateSalesTax(subtotal, ad.target_zip_code) : 0;

  let discount = 0;
  let appliedCode: string | null = null;
  if (promo_code && typeof promo_code === 'string') {
    const preview = await previewPromo({ code: promo_code, subtotalCents: subtotal, userId, service: 'booking' });
    if (!preview.valid) return res.status(400).json({ error: preview.reason });
    discount = preview.discount_cents;
    appliedCode = preview.code;
  }

  const total = Math.max(0, subtotal - discount + taxCents);
  const isFullyComped = discount >= subtotal;
  if (total === 0 || isFullyComped) {
    // Free via promo — only if already approved (approval required before any charge/activation)
    if (appliedCode) {
      await redeemPromo({ code: appliedCode, subtotalCents: subtotal, userId, service: 'booking', orderId: `FREE-${crypto.randomUUID()}` });
    }
    try {
      await prisma.$transaction([
        prisma.ad.update({ where: { id: String(ad_id) }, data: { payment_status: 'paid', status: 'active' } }),
        prisma.adReservation.createMany({ data: isoDates.map((s) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })), skipDuplicates: true }),
      ]);
    } catch (e) {
      console.error('Failed to create ad reservations for free promo:', e);
      return res.status(500).json({ error: 'Failed to reserve ad dates. Please try again.' });
    }
    // v1.0.2 audit fix: await to preserve audit trail on PaymentSheet free-promo path.
    try {
      await logTransaction({
        transactionType: 'AD_PURCHASE',
        status: 'COMPLETED',
        userId,
        subtotalCents: subtotal,
        taxCents: 0,
        discountCents: discount,
        promoCode: appliedCode || undefined,
        promoDiscountCents: discount,
        totalCents: 0,
        netCents: 0,
        currency: 'usd',
        metadata: { free_promo: true, ad_id: String(ad_id), dates: isoDates },
      });
    } catch (err) {
      console.error('[payments] Failed to log free promo transaction:', err);
      captureException(err as Error, { context: 'free_promo_transaction_log_pi', adId: String(ad_id) });
    }
    // Ad payment confirmation email removed — non-mandatory
    return res.json({ free: true });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        ad_id: String(ad_id),
        dates: JSON.stringify(isoDates),
        user_id: userId,
        subtotal_cents: String(subtotal),
        tax_cents: String(taxCents),
        promo_code: appliedCode || '',
        discount_cents: String(discount || 0),
        weekday_blocks: String(pricingResult.weekdayBlocks),
        weekend_blocks: String(pricingResult.weekendBlocks),
      },
    }, {
      // v1.0.2 audit fix: widen fallback window from 60s to 1h to prevent duplicate payment intents on retry
      idempotencyKey: (req.headers['x-idempotency-key'] as string) || `ad_pi_${userId}_${ad_id}_${Math.floor(Date.now() / (60 * 60 * 1000))}`,
    });

    // Hold slots atomically — re-check capacity inside transaction to prevent race conditions
    try {
      await prisma.$transaction(async (tx) => {
        // Re-verify slot capacity inside transaction to prevent concurrent overbooking
        if (ad.target_zip_code) {
          const competingAds = await tx.ad.findMany({
            where: { target_zip_code: ad.target_zip_code, payment_status: { in: ['paid', 'hold', 'pending_approval'] }, NOT: { id: String(ad_id) } },
            select: { id: true },
            take: 100,
          });
          if (competingAds.length > 0) {
            const dateObjects = isoDates.map((s) => new Date(s + 'T00:00:00.000Z'));
            const bookedSlots = await tx.adReservation.groupBy({
              by: ['date'],
              where: { ad_id: { in: competingAds.map((a) => a.id) }, date: { in: dateObjects } },
              _count: { date: true },
            });
            const fullDates = bookedSlots.filter((s) => s._count.date >= MAX_AD_SLOTS);
            if (fullDates.length > 0) {
              throw Object.assign(new Error('Slots full'), { slotFull: true, dates: fullDates.map((s) => s.date.toISOString().slice(0, 10)) });
            }
          }
        }
        await tx.ad.update({ where: { id: String(ad_id) }, data: { payment_status: 'hold' } });
        await tx.adReservation.createMany({
          data: isoDates.map((s) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })),
          skipDuplicates: true,
        });
      });
    } catch (holdErr: any) {
      // Cancel the payment intent since we can't hold the slots
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch (cancelErr) {
        console.warn('[payments] Failed to cancel payment intent after hold failure:', (cancelErr as Error)?.message);
      }
      console.error('[payments] Failed to hold ad slots, cancelled payment:', (holdErr as any)?.message);
      return res.status(409).json({ error: 'Ad slots are no longer available. Please try different dates.' });
    }

    // Log transaction
    await logTransaction({
      transactionType: 'AD_PURCHASE',
      status: 'PENDING',
      stripeSessionId: paymentIntent.id,
      userId,
      userEmail: user?.email || 'unknown',
      orderId: String(ad_id),
      subtotalCents: subtotal,
      taxCents,
      stripeFeeeCents: calculateStripeFee(total),
      discountCents: discount,
      totalCents: total,
      promoCode: appliedCode || undefined,
      promoDiscountCents: discount,
      metadata: { dates: isoDates, adId: ad_id, zipCode: ad.target_zip_code },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      paymentIntent: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey,
      amount_cents: total,
    });
  } catch (err: any) {
    captureException(err, { context: 'create_payment_sheet_ad', ad_id });
    return res.status(500).json({ error: err?.message || 'Unable to create payment' });
  }
}));

// Stripe webhook to finalize reservations on successful payment.
// IMPORTANT: The raw body parser is registered at the app level (server/src/index.ts)
// for route /payments/webhook BEFORE express.json(). Do not add parsers here.
paymentsRouter.post('/webhook', asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    // No signature = not from Stripe (bot, crawler, health check). Reject silently.
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set!');
    return res.status(400).json({ error: 'Webhook verification failed' });
  }
  let event: Stripe.Event;
  try {
    // req.body must be the raw Buffer provided by express.raw at app level
    event = stripe.webhooks.constructEvent((req as any).body, sig as string, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err?.message || err);
    captureException(err, { context: 'stripe_webhook_verification_failed' });
    return res.status(400).send('Webhook Error: Invalid signature');
  }

  let dedupRecorded = false;
  const releaseWebhookDedup = async () => {
    if (!dedupRecorded) return;
    try {
      await prisma.processedStripeEvent.deleteMany({ where: { event_id: event.id } });
      dedupRecorded = false;
    } catch (rollbackErr) {
      console.warn('[webhook] Failed to release dedup lock after processing error:', (rollbackErr as any)?.message || rollbackErr);
    }
  };

  // Event-level deduplication: reject replayed webhook events
  try {
    await prisma.processedStripeEvent.create({
      data: { event_id: event.id, event_type: event.type },
    });
    dedupRecorded = true;
  } catch (dedupErr: any) {
    if (dedupErr instanceof Prisma.PrismaClientKnownRequestError && dedupErr.code === 'P2002') {
      debugLog('[webhook] Duplicate event skipped', { event_id: event.id, event_type: event.type });
      return res.json({ received: true, deduplicated: true });
    }
    // Non-unique error — return 500 so Stripe retries later when DB is healthy.
    // Processing without dedup risks duplicate charges/subscriptions.
    console.error('[webhook] Failed to record event for dedup, rejecting for retry:', dedupErr?.message || dedupErr);
    return res.status(500).json({ error: 'Dedup recording failed, will retry' });
  }

  try {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session?.id) {
      console.error('[webhook] Malformed checkout.session.completed — missing session.id', { eventId: event.id });
      await releaseWebhookDedup();
      return res.status(400).json({ error: 'Invalid session object' });
    }
    try {
      await finalizeFromSession(session);
    } catch (e) {
      await releaseWebhookDedup();
      console.error('[webhook] CRITICAL: Error finalizing session — returning 500 for Stripe retry:', (e as any)?.message || e);
      captureException(e as Error, { context: 'stripe_webhook_finalize_failed', sessionId: session.id });
      return res.status(500).json({ error: 'Finalization failed' });
    }
  }
  
  // Send billing notification emails for subscription events
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.customer_email && invoice.subscription) {
      await sendBillingNoticeEmail({
        to: invoice.customer_email,
        type: 'payment_succeeded',
        amount: `$${(invoice.amount_paid / 100).toFixed(2)}`,
        planName: invoice.lines.data[0]?.description || 'VarsityHub Subscription',
      }).catch(err => console.warn('[billing-email] payment_succeeded failed:', err));
    }
    // Log renewal transaction
    if (invoice.customer && invoice.subscription) {
      const renewalUser = await prisma.user.findFirst({ where: { stripe_customer_id: String(invoice.customer) }, select: { id: true } });
      if (renewalUser) {
        // v1.0.2 audit fix: await so renewal audit trail is never silently dropped.
        try {
          await logTransaction({
            transactionType: 'SUBSCRIPTION_RENEWAL',
            status: 'COMPLETED',
            userId: renewalUser.id,
            totalCents: invoice.amount_paid || 0,
            stripeSessionId: String(invoice.id),
            stripeSubscriptionId: String(invoice.subscription),
            metadata: { event: 'invoice.payment_succeeded', period_end: invoice.period_end },
          });
        } catch (err) {
          captureException(err as Error, { context: 'renewal_transaction_log' });
        }
      }
    }
  }
  
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    // Mark user's subscription as past_due so the app can prompt for payment update
    if (invoice.customer && invoice.subscription) {
      const failedUser = await prisma.user.findFirst({ where: { stripe_customer_id: String(invoice.customer) } });
      if (failedUser) {
        await prisma.user.update({
          where: { id: failedUser.id },
          data: { subscription_status: 'past_due' },
        });
        console.warn('[webhook] invoice.payment_failed — marked user as past_due', { userId: failedUser.id, invoiceId: invoice.id });
      }
    }
    if (invoice.customer_email) {
      await sendBillingNoticeEmail({
        to: invoice.customer_email,
        type: 'payment_failed',
        planName: invoice.lines.data[0]?.description || 'VarsityHub Subscription',
      }).catch(err => console.warn('[billing-email] payment_failed failed:', err));
    }
  }
  
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
    if (!customerId) {
      console.error('[webhook] customer.subscription.deleted: subscription.customer is null');
      return res.status(400).json({ error: 'Missing customer ID' });
    }
    const customer = await stripe.customers.retrieve(customerId).catch(() => null);
    const customerEmail = customer && !customer.deleted ? customer.email : null;
    if (customerEmail) {
      await sendBillingNoticeEmail({
        to: customerEmail,
        type: 'subscription_canceled',
        planName: subscription.items?.data?.[0]?.price?.nickname || 'VarsityHub Subscription',
      }).catch(err => console.warn('[billing-email] subscription_canceled failed:', err));
    }

    // Downgrade user to rookie plan now that subscription period has ended
    const canceledUser = await prisma.user.findFirst({ where: { stripe_customer_id: customerId } });
    if (canceledUser) {
      const prefs = (canceledUser.preferences && typeof canceledUser.preferences === 'object') ? (canceledUser.preferences as any) : {};
      const previousPlan = prefs.plan || 'rookie';
      delete prefs.subscription_id;
      delete prefs.subscription_period_end;
      prefs.plan = 'rookie';
      // ATOMIC: downgrade + cancellation log must succeed or fail together
      await prisma.$transaction([
        prisma.user.update({
          where: { id: canceledUser.id },
          data: { preferences: prefs, subscription_tier: 'free', subscription_status: 'canceled' },
        }),
        prisma.transactionLog.create({
          data: {
            transaction_type: 'SUBSCRIPTION_CANCEL',
            status: 'COMPLETED',
            stripe_subscription_id: subscription.id,
            user_id: canceledUser.id,
            metadata: { reason: 'subscription_deleted', previous_plan: previousPlan },
            subtotal_cents: 0,
            tax_cents: 0,
            stripe_fee_cents: 0,
            discount_cents: 0,
            total_cents: 0,
            net_cents: 0,
            promo_discount_cents: 0,
            currency: 'usd',
          },
        }),
      ]);
    }
  }
  
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const subCustomerId = typeof subscription.customer === 'string' ? subscription.customer : null;
    if (!subCustomerId) {
      console.error('[webhook] customer.subscription.updated: subscription.customer is null');
      return res.status(400).json({ error: 'Missing customer ID' });
    }
    const customer = await stripe.customers.retrieve(subCustomerId).catch(() => null);
    const customerEmail = customer && !customer.deleted ? customer.email : null;

    // Sync subscription state to database (independent of email availability)
    const subUser = await prisma.user.findFirst({ where: { stripe_customer_id: subCustomerId } });
    if (subUser) {
      const priceId = subscription.items?.data?.[0]?.price?.id;
      // Map Stripe price ID back to plan tier
      let newTier: string = subUser.subscription_tier || 'free';
      if (priceId === process.env.STRIPE_PRICE_VETERAN) newTier = 'veteran';
      else if (priceId === process.env.STRIPE_PRICE_LEGEND) newTier = 'legend';

      const statusMap: Record<string, string> = {
        active: 'active', past_due: 'past_due', unpaid: 'unpaid',
        canceled: 'canceled', incomplete: 'incomplete', incomplete_expired: 'canceled',
        trialing: 'active', paused: 'paused',
      };
      const newStatus = statusMap[subscription.status] || subscription.status;

      // Also update preferences.plan to keep it in sync with subscription_tier
      const planFromTier = newTier === 'veteran' ? 'veteran' : newTier === 'legend' ? 'legend' : undefined;
      const updateData: any = { subscription_tier: newTier, subscription_status: newStatus };
      if (planFromTier && (newStatus === 'active')) {
        const existingPrefs = (subUser.preferences && typeof subUser.preferences === 'object') ? (subUser.preferences as any) : {};
        updateData.preferences = { ...existingPrefs, plan: planFromTier, pending_plan: null, payment_pending: false };
      }

      await prisma.user.update({
        where: { id: subUser.id },
        data: updateData,
      });
      console.log(`[webhook] subscription.updated: user ${subUser.id} -> tier=${newTier} status=${newStatus} plan=${planFromTier || 'unchanged'}`);

      // Update any PENDING transaction log created by PaymentSheet flow
      updateTransactionStatus(subscription.id, 'COMPLETED', {
        metadata: { event: 'subscription.updated', status: subscription.status },
      }).catch(err => captureException(err as Error, { context: 'sub_paymentsheet_transaction_update' }));
    }

    if (subscription.status === 'active' && customerEmail) {
      await sendBillingNoticeEmail({
        to: customerEmail,
        type: 'subscription_renewed',
        amount: `$${((subscription.items.data[0]?.price?.unit_amount || 0) / 100).toFixed(2)}`,
        planName: subscription.items.data[0]?.price?.nickname || 'VarsityHub Subscription',
      }).catch(err => console.warn('[billing-email] subscription_renewed failed:', err));
    }
  }

  // Handle expired checkout sessions — mark PENDING transactions as FAILED and release holds
  // v1.0.2 pass 8: handle Stripe-side refunds (admin or dispute) so the user's access
  // is correctly downgraded. Previously a refund issued via Stripe dashboard would not
  // affect the user's plan or ad — they kept access without paying.
  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    const charge = event.data.object as Stripe.Charge;
    const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    const refundAmount = charge.amount_refunded || charge.amount;
    try {
      // Find the original transaction by payment intent
      const tx = piId
        ? await prisma.transactionLog.findFirst({ where: { stripe_payment_intent_id: piId }, orderBy: { created_at: 'desc' } })
        : null;
      if (!tx) {
        console.error('[webhook] charge.refunded without matching transactionLog', { charge_id: charge.id, pi: piId });
        captureException(new Error('charge.refunded: no matching transaction'), { context: 'refund_no_tx', chargeId: charge.id });
      } else {
        // Mark the transaction REFUNDED with the actual refunded amount
        await prisma.transactionLog.update({
          where: { id: tx.id },
          data: {
            status: 'REFUNDED' as any,
            metadata: {
              ...(tx.metadata as any || {}),
              refund_source: event.type === 'charge.dispute.created' ? 'dispute' : 'stripe_dashboard',
              refunded_amount_cents: refundAmount,
              stripe_charge_id: charge.id,
              refunded_at: new Date().toISOString(),
            },
          },
        });

        // Cascade based on transaction type:
        // - SUBSCRIPTION_PURCHASE/RENEWAL → downgrade user to rookie immediately
        // - AD_PURCHASE → mark ad refunded + release reservations
        if (tx.user_id && (tx.transaction_type === 'SUBSCRIPTION_PURCHASE' || tx.transaction_type === 'SUBSCRIPTION_RENEWAL')) {
          const u = await prisma.user.findUnique({ where: { id: tx.user_id }, select: { preferences: true } });
          const prefs = (u?.preferences as any) || {};
          await prisma.user.update({
            where: { id: tx.user_id },
            data: {
              preferences: { ...prefs, plan: 'rookie', subscription_id: null, subscription_period_end: null },
              subscription_tier: 'free',
              subscription_status: 'cancelled',
              max_teams: 2,
            },
          });
          console.warn('[webhook] User downgraded to rookie after Stripe refund', { user_id: tx.user_id });
        } else if (tx.order_id && tx.transaction_type === 'AD_PURCHASE') {
          await prisma.$transaction([
            prisma.adReservation.deleteMany({ where: { ad_id: tx.order_id } }),
            prisma.ad.updateMany({
              where: { id: tx.order_id },
              data: { status: 'draft', payment_status: 'refunded' },
            }),
          ]);
          console.warn('[webhook] Ad refunded + reservations released', { ad_id: tx.order_id });
        }
      }
    } catch (refundErr: any) {
      console.error('[webhook] charge.refunded handler failed:', refundErr?.message);
      captureException(refundErr as Error, { context: 'webhook_charge_refunded' });
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    await updateTransactionStatus(session.id, 'FAILED', {
      metadata: { reason: 'checkout_expired' },
    }).catch(err => { console.error('[transaction-log] expired session update failed:', err); captureException(err as Error, { context: 'transaction_log_expired_session' }); });

    // Release ad slot holds if this was an ad checkout
    const expiredAdId = session.metadata?.ad_id;
    if (expiredAdId) {
      try {
        const heldAd = await prisma.ad.findUnique({ where: { id: expiredAdId }, select: { payment_status: true } });
        if (heldAd?.payment_status === 'hold') {
          await prisma.$transaction([
            prisma.adReservation.deleteMany({ where: { ad_id: expiredAdId } }),
            prisma.ad.update({ where: { id: expiredAdId }, data: { payment_status: 'unpaid' } }),
          ]);
          debugLog('[webhook] Released ad slot hold on checkout expiry', { ad_id: expiredAdId });
        }
      } catch (releaseErr) {
        console.error('[webhook] Failed to release ad hold on expiry:', (releaseErr as any)?.message);
        captureException(releaseErr as Error, { context: 'release_ad_hold_expired', adId: expiredAdId });
      }
    }
  }

  // Handle failed payment intents
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const meta = pi.metadata || {};
    await logTransaction({
      transactionType: meta.ad_id ? 'AD_PURCHASE' : 'SUBSCRIPTION_PURCHASE',
      status: 'FAILED',
      stripePaymentIntentId: pi.id,
      userId: meta.user_id || undefined,
      totalCents: pi.amount,
      metadata: { reason: pi.last_payment_error?.message || 'payment_failed', ...meta },
    }).catch(err => { console.error('[transaction-log] failed payment log failed:', err); captureException(err as Error, { context: 'transaction_log_failed_payment' }); });

    // Release ad slot holds on payment failure
    if (meta.ad_id) {
      try {
        const heldAd = await prisma.ad.findUnique({ where: { id: meta.ad_id }, select: { payment_status: true } });
        if (heldAd?.payment_status === 'hold') {
          await prisma.$transaction([
            prisma.adReservation.deleteMany({ where: { ad_id: meta.ad_id } }),
            prisma.ad.update({ where: { id: meta.ad_id }, data: { payment_status: 'unpaid' } }),
          ]);
          debugLog('[webhook] Released ad slot hold on payment failure', { ad_id: meta.ad_id });
        }
      } catch (releaseErr) {
        console.error('[webhook] Failed to release ad hold on payment failure:', (releaseErr as any)?.message);
        captureException(releaseErr as Error, { context: 'release_ad_hold_failed_pi', adId: meta.ad_id });
      }
    }

    // Notify user of failed payment
    if (meta.user_id) {
      const failedUser = await prisma.user.findUnique({ where: { id: meta.user_id } });
      if (failedUser?.email) {
        await sendBillingNoticeEmail({
          to: failedUser.email,
          type: 'payment_failed',
          amount: `$${(pi.amount / 100).toFixed(2)}`,
          planName: meta.ad_id ? 'Ad Purchase' : 'VarsityHub Subscription',
        }).catch(err => console.warn('[billing-email] payment_intent.failed notification failed:', err));
      }
    }
  }

  // Handle PaymentSheet ad payments (PaymentIntent-based, no Checkout Session)
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const meta = pi.metadata || {};
    if (meta.ad_id) {
      const adId = meta.ad_id;
      let piDates: string[] = [];
      try { piDates = JSON.parse(String(meta.dates || '[]')); } catch { /* ignore */ }
      if (piDates.length > 0) {
        try {
          await prisma.$transaction(async (tx) => {
            const MAX_AD_SLOTS = 2;
            const adRecord = await tx.ad.findUnique({ where: { id: adId }, select: { target_zip_code: true } });
            if (adRecord?.target_zip_code) {
              // Count paid and held ads (excluding this one) to check slot availability
              const reservedAdsInZip = await tx.ad.findMany({
                where: { target_zip_code: adRecord.target_zip_code, payment_status: { in: ['paid', 'hold', 'pending_approval'] }, NOT: { id: adId } },
                select: { id: true },
                take: 100,
              });
              if (reservedAdsInZip.length > 0) {
                const dateObjects = piDates.map((s) => new Date(s + 'T00:00:00.000Z'));
                const bookedSlots = await tx.adReservation.groupBy({
                  by: ['date'],
                  where: { ad_id: { in: reservedAdsInZip.map((a) => a.id) }, date: { in: dateObjects } },
                  _count: { date: true },
                });
                const fullDates = bookedSlots.filter((s) => s._count.date >= MAX_AD_SLOTS);
                if (fullDates.length > 0) {
                  const err = new Error('SLOT_FULL') as any;
                  err.slotFull = true;
                  err.dates = fullDates.map((s) => s.date.toISOString().slice(0, 10));
                  throw err;
                }
              }
            }
            // SECURITY: Only activate ads that have been approved by admin
            const adCheck = await tx.ad.findUnique({ where: { id: adId }, select: { status: true } });
            if (!adCheck || (adCheck.status !== 'approved' && adCheck.status !== 'active')) {
              throw new Error(`AD_NOT_APPROVED: Ad ${adId} status is ${adCheck?.status}, cannot activate`);
            }

            await tx.ad.update({ where: { id: adId }, data: { payment_status: 'paid', status: 'active' } });
            await tx.adReservation.createMany({
              data: piDates.map((s) => ({ ad_id: adId, date: new Date(s + 'T00:00:00.000Z') })),
              skipDuplicates: true,
            });
          }, { isolationLevel: 'Serializable' });

          // Update transaction (ad payment confirmation email removed — non-mandatory)
          await updateTransactionStatus(pi.id, 'COMPLETED', { stripePaymentIntentId: pi.id });
          // Ad was already approved before payment — no admin review needed

          // Redeem promo code if one was used — retry up to 3 times to prevent reuse
          if (meta.promo_code && meta.user_id) {
            const promoSubtotal = Number(meta.subtotal_cents || 0) || 0;
            let promoRedeemed = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                await redeemPromo({ code: meta.promo_code, subtotalCents: promoSubtotal, userId: meta.user_id || '', service: 'booking', orderId: pi.id });
                promoRedeemed = true;
                break;
              } catch (e) {
                console.warn(`[webhook] promo redeem attempt ${attempt}/3 failed:`, (e as any)?.message);
                if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
              }
            }
            if (!promoRedeemed) {
              // CRITICAL: Payment succeeded but promo usage wasn't decremented — promo can be reused.
              // Flag for manual review. Admin should manually decrement promo usage or disable the code.
              console.error('[webhook] ⛔ PROMO REDEEM FAILED after 3 attempts — promo code may be reusable', { code: meta.promo_code, pi_id: pi.id, userId: meta.user_id });
              captureException(new Error('Promo redemption failed after retries — revenue leak risk'), {
                context: 'promo_redeem_failed',
                promoCode: meta.promo_code,
                piId: pi.id,
                userId: meta.user_id,
                level: 'fatal',
              });
              updateTransactionStatus(pi.id, 'COMPLETED', {
                metadata: { promo_redemption_failed: true, promo_code: meta.promo_code },
              }).catch((err) => console.warn('[webhook] failed to flag promo redemption failure:', err));
            }
          }
        } catch (e: any) {
          if (e?.slotFull) {
            console.error('[payments] SLOT_FULL on payment_intent.succeeded — issuing auto-refund', { ad_id: adId, dates: e.dates, pi_id: pi.id });
            // Auto-refund: charge the user's card back immediately
            try {
              const refund = await stripe.refunds.create({ payment_intent: pi.id, reason: 'requested_by_customer' });
              await updateTransactionStatus(pi.id, 'REFUNDED', {
                metadata: { reason: 'slot_full', overbooked_dates: e.dates, stripe_refund_id: refund.id },
              });
              // Notify user their dates were unavailable and they've been refunded
              const adForRefund = await prisma.ad.findUnique({ where: { id: adId }, select: { business_name: true, target_zip_code: true } });
              const refundUser = meta.user_id ? await prisma.user.findUnique({ where: { id: meta.user_id }, select: { email: true } }) : null;
              if (refundUser?.email) {
                sendBillingNoticeEmail({
                  to: refundUser.email,
                  type: 'payment_failed',
                  planName: `Ad Reservation for ${adForRefund?.business_name || 'your ad'}`,
                  amount: `$${(pi.amount / 100).toFixed(2)}`,
                  perks: [`Your selected dates in zip code ${adForRefund?.target_zip_code || 'N/A'} were fully booked. You have been fully refunded $${(pi.amount / 100).toFixed(2)}.`],
                }).catch(err => {
                  console.error('[payments] Failed to send refund email:', err);
                  captureException(err as Error, { context: 'slot_full_refund_email', adId, piId: pi.id });
                });
              }
            } catch (refundErr: any) {
              // Refund failed — this is critical, requires manual intervention
              console.error('[payments] CRITICAL: Auto-refund FAILED for SLOT_FULL', { ad_id: adId, pi_id: pi.id, error: refundErr?.message });
              captureException(refundErr as Error, { context: 'slot_full_auto_refund_failed', adId, piId: pi.id, amount: pi.amount });
              await updateTransactionStatus(pi.id, 'FAILED', {
                metadata: { reason: 'slot_full_refund_failed', overbooked_dates: e.dates, refund_failed: true },
              }).catch(err => { console.error('[transaction-log] PI slot-full status update failed:', err); captureException(err as Error, { context: 'transaction_log_slot_full_pi' }); });
              await releaseWebhookDedup();
              return res.status(500).json({ error: 'Auto-refund failed; retrying webhook' });
            }
          } else {
            await releaseWebhookDedup();
            console.error('[payments] CRITICAL: Error processing ad PI succeeded — returning 500 for Stripe retry', { ad_id: adId, pi_id: pi.id, error: e });
            captureException(e as Error, { context: 'payment_intent_succeeded_ad', adId, piId: pi.id });
            return res.status(500).json({ error: 'Ad processing failed' });
          }
        }
      }
    }
  }

  } catch (eventErr: any) {
    await releaseWebhookDedup();
    console.error('[webhook] CRITICAL: Unhandled webhook processing failure:', eventErr?.message || eventErr);
    captureException(eventErr as Error, { context: 'stripe_webhook_unhandled_processing_error', eventType: event.type, eventId: event.id });
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  return res.json({ received: true });
}));


// Cancel an abandoned PaymentIntent and mark transaction as FAILED
paymentsRouter.post('/cancel-intent', expressPkg.json(), requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  const cancelIntentSchema = z.object({
    payment_intent_id: z.string().min(1),
  });
  const parsed = cancelIntentSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
  const { payment_intent_id } = parsed.data;
  try {
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    // Only cancel if the PI belongs to this user and is still cancelable
    if (pi.metadata?.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)) {
      await stripe.paymentIntents.cancel(payment_intent_id);
    }
    await updateTransactionStatus(payment_intent_id, 'FAILED', {
      metadata: { reason: 'user_abandoned', canceled_at: new Date().toISOString() },
    }).catch(err => { console.error('[transaction-log] cancel-intent log failed:', err); captureException(err as Error, { context: 'cancel_intent_log' }); });

    // Cancel incomplete subscription if this PI belongs to one (prevents orphaned subscriptions in Stripe)
    if (pi.invoice) {
      try {
        const invoice = await stripe.invoices.retrieve(String(pi.invoice));
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(invoice.subscription));
          if (sub.status === 'incomplete') {
            await stripe.subscriptions.cancel(sub.id);
            debugLog('[payments] Canceled incomplete subscription on cancel-intent', { sub_id: sub.id });
          }
        }
      } catch (subErr) {
        console.warn('[payments] Failed to cancel incomplete subscription:', (subErr as any)?.message);
      }
    }

    // Release ad slot holds if this was an ad payment
    const cancelAdId = pi.metadata?.ad_id;
    if (cancelAdId) {
      const heldAd = await prisma.ad.findUnique({ where: { id: cancelAdId }, select: { payment_status: true } });
      if (heldAd?.payment_status === 'hold') {
        await prisma.$transaction([
          prisma.adReservation.deleteMany({ where: { ad_id: cancelAdId } }),
          prisma.ad.update({ where: { id: cancelAdId }, data: { payment_status: 'unpaid' } }),
        ]).catch(releaseErr => {
          console.error('[payments] Failed to release hold on cancel-intent:', (releaseErr as any)?.message);
        });
      }
    }

    return res.json({ canceled: true });
  } catch (err: any) {
    console.warn('[payments] cancel-intent error:', err?.message);
    return res.json({ canceled: false });
  }
}));

// Create a subscription Checkout Session for recurring membership plans
paymentsRouter.post('/subscribe', expressPkg.json(), requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const subscribeSchema = z.object({
      plan: z.string().min(1),
      promo_code: z.string().optional(),
    });
    const parsed = subscribeSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { plan, promo_code } = parsed.data;
    const { url, sessionId } = await createMembershipCheckoutSession(req, plan, promo_code);
    return res.json({ url, session_id: sessionId });
  } catch (err: any) {
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
    return res.status(status).json({ error: err?.message || 'Unable to start subscription checkout' });
  }
}));

// Cancel an active membership subscription
paymentsRouter.post('/subscription/cancel', expressPkg.json(), requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
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
      return res.status(500).json({ error: 'Failed to cancel subscription with Stripe' });
    }

    // Log the cancellation request
    await logTransaction({
      transactionType: 'SUBSCRIPTION_CANCEL',
      status: 'COMPLETED',
      stripeSubscriptionId: subscriptionId,
      userId,
      metadata: { action: 'cancel_at_period_end', plan: prefs.plan },
    }).catch(err => { console.error('[transaction-log] cancel request log failed:', err); captureException(err as Error, { context: 'transaction_log_cancel_request' }); });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error cancelling subscription:', (err as any)?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
}));

// v1.0.2 pass 9: resume a cancel-at-period-end subscription before period actually ends.
// Mirrors /subscription/cancel; just sets cancel_at_period_end back to false.
// v1.0.2 pass 10: explicit requireAuth for defense-in-depth (matches pattern set in earlier passes).
// Logged as SUBSCRIPTION_CANCEL with metadata.action='resume_cancel_at_period_end' since
// SUBSCRIPTION_RESUME isn't in the TransactionType enum (would need a migration).
paymentsRouter.post('/subscription/resume', expressPkg.json(), requireAuth as any, requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
    const subscriptionId: string | undefined = typeof prefs.subscription_id === 'string' ? prefs.subscription_id : undefined;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'No subscription to resume' });
    }
    let sub: Stripe.Subscription;
    try {
      sub = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (err: any) {
      return res.status(404).json({ error: 'Subscription not found in Stripe', detail: err?.message });
    }
    if (!sub.cancel_at_period_end) {
      return res.json({ ok: true, message: 'Subscription is already active', already_active: true });
    }
    if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
      return res.status(400).json({
        error: 'Subscription has already ended. Please subscribe again.',
        code: 'SUBSCRIPTION_ENDED',
      });
    }
    try {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
    } catch (err: any) {
      console.warn('Failed to resume subscription:', err?.message || err);
      return res.status(500).json({ error: 'Failed to resume subscription with Stripe' });
    }
    await logTransaction({
      transactionType: 'SUBSCRIPTION_CANCEL',
      status: 'COMPLETED',
      stripeSubscriptionId: subscriptionId,
      userId,
      metadata: { action: 'resume_cancel_at_period_end', plan: prefs.plan },
    }).catch(err => { console.error('[transaction-log] resume log failed:', err); captureException(err as Error, { context: 'transaction_log_resume' }); });
    return res.json({ ok: true, resumed: true });
  } catch (err) {
    console.error('Error resuming subscription:', (err as any)?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
}));

// Update subscription quantity for Veteran plan
paymentsRouter.post('/update-subscription-quantity', expressPkg.json(), requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });

    const userId = req.user!.id;
    const updateQuantitySchema = z.object({
      team_count: z.number().int().min(3, 'Minimum 3 total teams required for Veteran plan.'),
    });
    const parsed = updateQuantitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { team_count } = parsed.data;
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

    // CRITICAL: Verify user actually owns this many teams before updating payment
    const actualTeamCount = await prisma.teamMembership.count({
      where: {
        user_id: userId,
        role: 'owner',
        status: 'active'
      }
    });

    if (team_count !== actualTeamCount) {
      return res.status(400).json({
        error: 'Team count mismatch',
        message: `You currently own ${actualTeamCount} team${actualTeamCount !== 1 ? 's' : ''} but requested to pay for ${team_count}. You can only pay for teams you own.`,
        owned_teams: actualTeamCount,
        requested_teams: team_count
      });
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
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

      // Log the quantity update
      logTransaction({
        transactionType: 'SUBSCRIPTION_PURCHASE',
        status: 'COMPLETED',
        userId,
        stripeSubscriptionId: subscriptionId,
        metadata: { event: 'quantity_update', new_quantity: billable, total_teams: team_count, subscription_id: subscriptionId },
      }).catch(err => captureException(err as Error, { context: 'quantity_update_transaction_log' }));

      debugLog(`[payments] Updated subscription ${subscriptionId} billable quantity to ${billable} (total teams ${team_count})`);

      return res.json({
        ok: true,
        subscription_id: subscriptionId,
        total_teams: team_count,
        billable_teams: billable,
        monthly_cost: billable * 1.00
      });
    } catch (err: any) {
      console.warn('Failed to update Stripe subscription quantity:', err?.message || err);
      return res.status(500).json({ error: 'Failed to update subscription quantity' });
    }
  } catch (err) {
    console.error('Error updating subscription quantity:', (err as any)?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
}));

// Debug endpoint to check and fix subscription status discrepancies
paymentsRouter.get('/debug/subscription-status', requireVerified as any, requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
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
}));

// Subscription summary for Billing screen
// v1.0.2: GET /payments/history — list user's own billing transactions (most recent first).
// Backs the new manage-subscription billing history view.
paymentsRouter.get('/history', requireAuth as any, requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const rows = await prisma.transactionLog.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      id: true,
      transaction_type: true,
      status: true,
      total_cents: true,
      currency: true,
      promo_code: true,
      promo_discount_cents: true,
      created_at: true,
      metadata: true,
    },
  });
  return res.json({
    transactions: rows.map(r => ({
      id: r.id,
      type: r.transaction_type,
      status: r.status,
      amount_cents: r.total_cents,
      currency: r.currency,
      promo_code: r.promo_code,
      promo_discount_cents: r.promo_discount_cents,
      created_at: r.created_at.toISOString(),
    })),
  });
}));

paymentsRouter.get('/subscription/summary', requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
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
        if (typeof quantity === 'number') monthly_cost = Number((quantity * 1.0).toFixed(2));
      } catch (err) {
        console.warn('[payments] Failed to retrieve summary subscription:', (err as any)?.message || err);
      }
    } else if (plan === 'legend') {
      // Annual cost fixed at $29.99
      annual_cost = 29.99;
      // status can be determined if subscription id exists
      if (subscriptionId && process.env.STRIPE_SECRET_KEY) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          status = sub.status;
          if (sub.current_period_end) current_period_end = new Date(sub.current_period_end * 1000).toISOString();
        } catch (err) {
          console.warn('[payments] Failed to retrieve Legend subscription:', (err as any)?.message || err);
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
}));

// Endpoint to reset subscription status to rookie (for fixing invalid states)
paymentsRouter.post('/debug/reset-to-rookie', requireVerified as any, requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
    
    // Reset subscription-related preferences
    const nextPrefs: any = { ...prefs };
    nextPrefs.plan = 'rookie';
    delete nextPrefs.pending_plan;
    delete nextPrefs.subscription_id;
    delete nextPrefs.subscription_period_end;
    delete nextPrefs.stripe_customer_id;
    delete nextPrefs.payment_pending;
    delete nextPrefs.payment_approved;

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
}));

// Admin endpoint to reset all users with unpaid subscriptions
paymentsRouter.post('/admin/reset-unpaid-subscriptions', requireVerified as any, requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {

    debugLog('🔍 Admin-initiated bulk reset of unpaid subscriptions...');

    // Find users with paid plans — filter subscription_id in JavaScript (JSON null detection is Prisma-version-specific)
    const paidPlanUsers = await prisma.user.findMany({
      where: {
        OR: [
          { preferences: { path: ['plan'], equals: 'veteran' } },
          { preferences: { path: ['plan'], equals: 'legend' } },
        ],
      },
      select: {
        id: true,
        email: true,
        display_name: true,
        preferences: true,
      },
      take: 5000,
    });
    // Filter out users who DO have a subscription_id — these are legitimate paid users
    const usersToReset = paidPlanUsers.filter(user => {
      const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
      return !prefs.subscription_id;
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
    const resetUsers: Array<{ email: string; name: string | null; previousPlan: string }> = [];

    // Batch update: build all update operations, then execute in a single transaction
    const updateOps = usersToReset.map((user) => {
      const currentPrefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
      const nextPrefs: any = { ...currentPrefs };
      nextPrefs.plan = 'rookie';
      delete nextPrefs.pending_plan;
      delete nextPrefs.subscription_id;
      delete nextPrefs.subscription_period_end;
      delete nextPrefs.stripe_customer_id;
      delete nextPrefs.payment_pending;
      delete nextPrefs.payment_approved;

      resetUsers.push({
        email: user.email,
        name: user.display_name,
        previousPlan: currentPrefs.plan,
      });

      return prisma.user.update({
        where: { id: user.id },
        data: { preferences: nextPrefs },
      });
    });

    try {
      await prisma.$transaction(updateOps);
      resetCount = usersToReset.length;
      for (const u of resetUsers) {
        debugLog(`✅ Admin reset: ${u.email} to rookie plan`);
      }
    } catch (error) {
      console.error('[payments] Failed to batch reset users:', (error as any)?.message || error);
      // Partial failure info not available with $transaction, report total attempted
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
}));

// Authenticated helper to finalize a Checkout Session by id when webhooks are unavailable
paymentsRouter.post('/finalize-session', expressPkg.json(), requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const finalizeSchema = z.object({
      session_id: z.string().min(1),
    });
    const parsed = finalizeSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { session_id } = parsed.data;
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

      // Return ad details for the confirmation screen
      const sessionMeta = session.metadata || {};
      const adId = sessionMeta.ad_id || '';
      let adDates: string[] = [];
      try { adDates = JSON.parse(String(sessionMeta.dates || '[]')); } catch { /* ignore */ }
      let adDetails: any = null;
      if (adId) {
        const ad = await prisma.ad.findUnique({
          where: { id: adId },
          select: { id: true, business_name: true, status: true, payment_status: true, target_zip_code: true },
        });
        if (ad) {
          adDetails = {
            id: ad.id,
            business_name: ad.business_name,
            status: ad.status,
            payment_status: ad.payment_status,
            zip_code: ad.target_zip_code,
            dates: adDates,
          };
        }
      }
      const amountPaid = typeof session.amount_total === 'number' ? session.amount_total : 0;
      return res.json({ ok: true, ad: adDetails, amount_cents: amountPaid });
    } catch (err) {
      console.error('Failed to finalize session:', (err as any)?.message || err);
      return res.status(500).json({ error: 'Failed to finalize session' });
    }
  } catch (err) {
    console.error('Finalize-session error:', (err as any)?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
}));

// Per-session lock to prevent concurrent finalization (H2 — client/webhook race).
// Uses local promise dedupe + Redis distributed lock (when REDIS_URL is configured).
const finalizeSessionLocks = new Map<string, Promise<void>>();

// Optional helper to finalize payment based on a Checkout Session's metadata (fallback if webhook is not configured)
async function finalizeFromSession(session: Stripe.Checkout.Session) {
  await withDistributedLock(
    {
      namespace: 'payments:finalize-session',
      key: session.id,
      ttlMs: 10 * 60 * 1000,
      acquireTimeoutMs: 45 * 1000,
      retryDelayMs: 150,
      localLocks: finalizeSessionLocks,
    },
    async () => {
      await runFinalizeFromSession(session);
    }
  );
}

async function runFinalizeFromSession(session: Stripe.Checkout.Session) {
  debugLog('[payments] finalizeFromSession called', {
    session_id: session.id,
    payment_status: session.payment_status,
    status: session.status,
    metadata: session.metadata
  });

  const meta = session.metadata || {};
  const transactionLog = await getTransactionBySession(session.id);
  if (transactionLog?.status === 'COMPLETED') {
    debugLog('[payments] finalizeFromSession skipped — already COMPLETED', { session_id: session.id });
    return;
  }
  const metadataUserId = meta.user_id ? String(meta.user_id) : null;
  const inferredUserId = metadataUserId || (transactionLog?.user_id ? String(transactionLog.user_id) : null);
  const fallbackEmail = transactionLog?.user?.email || transactionLog?.user_email || (session.customer_details?.email ?? null);
  const totalCents = typeof session.amount_total === 'number'
    ? session.amount_total
    : Number(meta.total_cents || transactionLog?.total_cents || 0) || 0;
  const ad_id = meta.ad_id || '';
  let dates: string[] = [];
  try { dates = JSON.parse(String(meta.dates || '[]')); } catch (err) {
    console.warn('[payments] Failed to parse ad dates from session metadata:', (err as any)?.message || err);
  }
  if (ad_id && Array.isArray(dates) && dates.length) {
    debugLog('[payments] Processing ad reservation payment', {
      ad_id,
      dates,
      session_id: session.id,
      payment_status: session.payment_status
    });
    try {
      await prisma.$transaction(async (tx) => {
        // Re-check slot availability under serializable isolation.
        // This is the second line of defence after the pre-checkout check —
        // it catches the race where two sessions were created before either paid.
        const MAX_AD_SLOTS = 2;
        const adRecord = await tx.ad.findUnique({ where: { id: ad_id }, select: { target_zip_code: true } });
        if (adRecord?.target_zip_code) {
          const reservedAdsInZip = await tx.ad.findMany({
            where: { target_zip_code: adRecord.target_zip_code, payment_status: { in: ['paid', 'hold', 'pending_approval'] }, NOT: { id: ad_id } },
            select: { id: true },
            take: 100,
          });
          if (reservedAdsInZip.length > 0) {
            const dateObjects = dates.map((s) => new Date(s + 'T00:00:00.000Z'));
            const bookedSlots = await tx.adReservation.groupBy({
              by: ['date'],
              where: { ad_id: { in: reservedAdsInZip.map((a) => a.id) }, date: { in: dateObjects } },
              _count: { date: true },
            });
            const fullDates = bookedSlots.filter((s) => s._count.date >= MAX_AD_SLOTS);
            if (fullDates.length > 0) {
              const err = new Error('SLOT_FULL') as any;
              err.slotFull = true;
              err.dates = fullDates.map((s) => s.date.toISOString().slice(0, 10));
              throw err;
            }
          }
        }

        // SECURITY: Only activate ads that have been approved by admin.
        // Prevents paying for pending/rejected ads to bypass approval.
        const adCheck = await tx.ad.findUnique({ where: { id: ad_id }, select: { status: true, payment_status: true } });
        // Idempotency: if already paid (duplicate webhook), exit cleanly
        if (adCheck?.payment_status === 'paid') {
          console.log(`[payments] Idempotent: ad ${ad_id} already paid, skipping duplicate activation`);
          return;
        }
        if (!adCheck || (adCheck.status !== 'approved' && adCheck.status !== 'active')) {
          throw new Error(`AD_NOT_APPROVED: Ad ${ad_id} status is ${adCheck?.status}, cannot activate`);
        }

        // v1.0.2 audit hardening: use conditional updateMany so we fail if admin rejected
        // the ad between our read above and the write below. updateMany with status filter
        // returns count:0 if the row is no longer in an activatable state.
        const updated = await tx.ad.updateMany({
          where: { id: ad_id, status: { in: ['approved', 'active'] } },
          data: { payment_status: 'paid', status: 'active' },
        });
        if (updated.count === 0) {
          throw new Error(`AD_NOT_APPROVED: Ad ${ad_id} was no longer approved at activation time`);
        }
        await tx.adReservation.createMany({
          data: dates.map((s) => ({ ad_id, date: new Date(s + 'T00:00:00.000Z') })),
          skipDuplicates: true,
        });
      }, { isolationLevel: 'Serializable' });

      debugLog('[payments] Ad reservation payment completed successfully', {
        ad_id,
        dates,
        session_id: session.id,
        status: 'active'
      });
      
      // Update transaction log to COMPLETED
      await updateTransactionStatus(session.id, 'COMPLETED', {
        stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : undefined,
      });
      // Fetch ad details for the email
      const adForEmail = await prisma.ad.findUnique({
        where: { id: ad_id },
        select: { business_name: true, target_zip_code: true },
      });
      // Ad payment confirmation email removed — non-mandatory
      // Ad was already approved before payment — no admin review needed
    } catch (e: any) {
      if (e?.slotFull) {
        // Expected: another payment beat this one to the last slot(s).
        // Auto-refund immediately instead of requiring manual intervention.
        console.error('[payments] SLOT_FULL: ad dates overbooked after payment — issuing auto-refund', {
          ad_id,
          full_dates: e.dates,
          session_id: session.id,
        });
        try {
          const piId = session.payment_intent ? String(session.payment_intent) : '';
          if (piId) {
            const refund = await stripe.refunds.create({ payment_intent: piId, reason: 'requested_by_customer' });
            // v1.0.2 audit fix: persist refunded amount in metadata for audit trail.
            // Previously only stripe_refund_id was saved — no record of how much was refunded.
            await updateTransactionStatus(session.id, 'REFUNDED', {
              metadata: {
                reason: 'slot_full',
                overbooked_dates: e.dates,
                stripe_refund_id: refund.id,
                refunded_amount_cents: refund.amount ?? totalCents,
                refund_currency: refund.currency || 'usd',
                refund_status: refund.status || 'pending',
                refunded_at: new Date().toISOString(),
              },
            });
            // Notify user
            if (fallbackEmail) {
              const adForRefund = await prisma.ad.findUnique({ where: { id: ad_id }, select: { business_name: true, target_zip_code: true } });
              sendBillingNoticeEmail({
                to: fallbackEmail,
                type: 'payment_failed',
                planName: `Ad Reservation for ${adForRefund?.business_name || 'your ad'}`,
                amount: `$${(totalCents / 100).toFixed(2)}`,
                perks: [`Your selected dates in zip code ${adForRefund?.target_zip_code || 'N/A'} were fully booked. You have been fully refunded $${(totalCents / 100).toFixed(2)}.`],
              }).catch(err => {
                console.error('[payments] Failed to send refund email:', err);
                captureException(err as Error, { context: 'slot_full_refund_email_session', sessionId: session.id });
              });
            }
          } else {
            // No payment_intent to refund from session — mark for manual refund
            console.error('[payments] CRITICAL: No payment_intent on session for auto-refund', { session_id: session.id });
            captureException(new Error('SLOT_FULL: no payment_intent for refund'), { context: 'slot_full_no_pi', sessionId: session.id });
            await updateTransactionStatus(session.id, 'FAILED', {
              metadata: { reason: 'slot_full_refund_missing_payment_intent', overbooked_dates: e.dates, refund_failed: true },
            }).catch(err => { console.error('[transaction-log] slot-full status update failed:', err); captureException(err as Error, { context: 'transaction_log_slot_full' }); });
            throw new Error('SLOT_FULL_REFUND_MISSING_PAYMENT_INTENT');
          }
        } catch (refundErr: any) {
          console.error('[payments] CRITICAL: Auto-refund FAILED for SLOT_FULL', { session_id: session.id, error: refundErr?.message });
          captureException(refundErr as Error, { context: 'slot_full_auto_refund_failed_session', sessionId: session.id });
          await updateTransactionStatus(session.id, 'FAILED', {
            metadata: { reason: 'slot_full_refund_failed', overbooked_dates: e.dates, refund_failed: true },
          }).catch(err => { console.error('[transaction-log] slot-full status update failed:', err); captureException(err as Error, { context: 'transaction_log_slot_full' }); });
          throw refundErr;
        }
        return;
      }
      console.error('[payments] Error processing ad reservation payment', {
        ad_id,
        dates,
        session_id: session.id,
        error: e,
      });
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
      try {
        // v1.0.2 audit hardening: re-fetch the session from Stripe immediately before mutating user state.
        // Closes a TOCTOU window where a stale/replayed session object could carry an old "paid" flag.
        try {
          const fresh = await stripe.checkout.sessions.retrieve(String(session.id));
          if (fresh?.payment_status !== 'paid') {
            console.error('[payments] finalize aborted — session no longer paid on re-verify', {
              session_id: session.id,
              fresh_status: fresh?.payment_status,
              userId,
            });
            return;
          }
        } catch (reverifyErr: any) {
          // v1.0.2 audit pass 4: if Stripe is unreachable during re-verify, we MUST NOT silently
          // drop the payment record. User already paid (that's how we got here with paid=true from
          // the webhook payload). Mark the transaction for manual reconciliation instead of
          // proceeding blindly — the ops team can decide whether to trust the webhook.
          console.error('[payments] finalize aborted — session re-verify failed (transaction marked NEEDS_REVIEW)', {
            session_id: session.id,
            err: reverifyErr?.message || reverifyErr,
            userId,
          });
          captureException(reverifyErr as Error, {
            context: 'finalize_reverify_failed',
            sessionId: String(session.id),
            userId,
          });
          try {
            await updateTransactionStatus(session.id, 'NEEDS_REVIEW' as any, {
              metadata: {
                reason: 'session_reverify_api_failed',
                reverify_error: String(reverifyErr?.message || reverifyErr),
                webhook_payment_status: session.payment_status,
                flagged_at: new Date().toISOString(),
              },
            });
          } catch (markErr) {
            console.error('[payments] Failed to mark transaction NEEDS_REVIEW:', markErr);
          }
          return;
        }
        const current = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        if (!current) { console.error('[payments] finalizeFromSession: user not found', userId); return; }
        const existingPrefs = (current?.preferences && typeof current.preferences === 'object') ? (current.preferences as any) : {};
        // Rule A: Clear pending_plan and payment flags on successful payment
        const { pending_plan: _pp, payment_approved: _pa, join_request_pending: _jrp, ...cleanPrefs } = existingPrefs;
        const prefs: any = { ...cleanPrefs, plan, pending_plan: null, payment_pending: false };
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

        // Update max_teams and subscription_tier based on plan
        const maxTeams = getMaxTeamsForPlan(plan);
        const subscriptionTier = plan === 'rookie' ? 'free' : plan === 'veteran' ? 'premium' : 'pro';

        // ATOMIC: user update + transaction log must succeed or fail together
        // Cancel old subscription AFTER DB commit — if cancel-first fails, user loses access
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: {
              preferences: prefs,
              max_teams: maxTeams ?? 999,
              subscription_tier: subscriptionTier,
              subscription_status: 'active'
            }
          }),
          prisma.transactionLog.update({
            where: { stripe_session_id: session.id },
            data: {
              status: 'COMPLETED',
              updated_at: new Date(),
              stripe_payment_intent_id: session.payment_intent ? String(session.payment_intent) : undefined,
              stripe_subscription_id: session.subscription ? String(session.subscription) : undefined,
            },
          }),
        ]);

        // Cancel old Stripe subscription AFTER successful DB commit to prevent double-billing.
        // Order matters: new sub verified (line above) → DB updated → old sub canceled.
        // If we canceled first and the DB write failed, the user would lose access entirely.
        const oldSubId = existingPrefs.subscription_id;
        if (oldSubId && prefs.subscription_id && oldSubId !== prefs.subscription_id && String(oldSubId).startsWith('sub_')) {
          try {
            await stripe.subscriptions.cancel(String(oldSubId));
            console.info('[payments] Canceled old subscription on upgrade', { old_sub: oldSubId, new_sub: prefs.subscription_id, userId });
          } catch (cancelErr: any) {
            // Log but don't block — old sub may already be canceled/expired.
            // Worst case: user gets double-billed briefly, but new sub is active and old will expire.
            console.warn('[payments] Failed to cancel old subscription (may already be inactive):', cancelErr?.message || cancelErr);
          }
        }
        console.info('[payments] membership finalize', {
          userId,
          plan,
          max_teams: maxTeams ?? 999,
          subscription_tier: subscriptionTier,
          subscription_id: prefs.subscription_id,
          subscription_period_end: prefs.subscription_period_end
        });

        // Email is non-critical — fire after atomic commit
        sendSubscriptionEmail({
          userId,
          fallbackEmail,
          plan,
          totalCents,
        }).catch(err => console.warn('[payments] subscription email failed:', (err as any)?.message || err));
      } catch (err) {
        console.error('[payments] Failed to finalize membership from session:', (err as any)?.message || err);
        captureException(err as Error, { context: 'finalize_membership_from_session', sessionId: session.id, userId, plan });
        throw err;
      }
    }
  }

  if (code && userId && subtotalCents > 0) {
    let redeemed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await redeemPromo({ code, userId, subtotalCents, service: 'booking', orderId: session.id });
        redeemed = true;
        break;
      } catch (e) {
        console.warn(`[payments] Promo redemption attempt ${attempt}/3 failed:`, (e as any)?.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
    if (!redeemed) {
      console.error('[payments] Promo redemption FAILED after 3 attempts — flagging', { code, userId, session_id: session.id });
      captureException(new Error('Promo redemption failed after retries (session)'), { context: 'promo_redeem_failed_session', promoCode: code, sessionId: session.id, userId });
    }
  }
}

// Human-facing pages for success/cancel, with success also attempting confirmation if session_id present
// v1.0.2 pass 11: /success is a PUBLIC GET that triggers Stripe + DB writes via finalizeFromSession.
// Without a rate limit, an attacker spamming arbitrary session_id values forces real Stripe API
// calls per request. paymentLimiter caps abuse without breaking legitimate post-checkout redirects.
paymentsRouter.get('/success', paymentLimiter, asyncHandler(async (req, res) => {
  const appScheme = process.env.APP_SCHEME || 'varsityhubmobile';
  const appReturnPath = process.env.APP_RETURN_PATH || '';
  const returnUrl = `${appScheme}://${appReturnPath}`;
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : undefined;
  if (sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      // Dedup: only finalize if not already processed by webhook
      const alreadyProcessed = await prisma.processedStripeEvent.findFirst({
        where: { event_id: `success_page_${sessionId}` },
      });
      if (!alreadyProcessed) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session && session.payment_status === 'paid') {
          await finalizeFromSession(session);
          await prisma.processedStripeEvent.create({
            data: { event_id: `success_page_${sessionId}`, event_type: 'success_page_finalize' },
          }).catch(() => {}); // Ignore duplicate key
        }
      }
    } catch (e) {
      console.error('[payments] Post-payment finalization failed:', { session_id: sessionId, error: (e as any)?.message || e });
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
}));

// ── Apple IAP Receipt Verification ──────────────────────────────────
const APPLE_SHARED_SECRET = process.env.APPLE_IAP_SHARED_SECRET || '';
const APPLE_VERIFY_URL_PRODUCTION = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_URL_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

const APPLE_PRODUCT_TO_PLAN: Record<string, string> = {
  MIDTIER: 'veteran',
  TOPTIER: 'legend',
};

const APPLE_AD_PRODUCTS = ['MOND_THURS', 'FRI_SUN'] as const;
const AD_PRODUCT_CENTS: Record<string, number> = {
  MOND_THURS: 499,
  FRI_SUN: 799,
};

async function verifyAppleReceipt(receiptData: string, useSandbox = false): Promise<any> {
  const url = useSandbox ? APPLE_VERIFY_URL_SANDBOX : APPLE_VERIFY_URL_PRODUCTION;
  const body = JSON.stringify({
    'receipt-data': receiptData,
    password: APPLE_SHARED_SECRET,
    'exclude-old-transactions': true,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    return resp.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Apple IAP receipt validation
paymentsRouter.post('/apple/verify-receipt', expressPkg.json(), requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!APPLE_SHARED_SECRET) {
      console.warn('[apple-iap] APPLE_IAP_SHARED_SECRET not configured — cannot verify receipts');
      return res.status(503).json({ error: 'IAP verification not configured. Please contact support.' });
    }
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const appleReceiptSchema = z.object({
      receipt: z.string().min(1),
      productId: z.string().min(1),
    });
    const parsed = appleReceiptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { receipt, productId } = parsed.data;

    const plan = APPLE_PRODUCT_TO_PLAN[productId];
    if (!plan) {
      return res.status(400).json({ error: `Unknown product: ${productId}` });
    }

    // Verify with Apple — production only. Sandbox receipts rejected in production.
    let result = await verifyAppleReceipt(receipt, false);
    if (result.status === 21007) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({ error: 'Sandbox receipts are not accepted in production' });
      }
      // Development/staging only: fall back to sandbox verification
      result = await verifyAppleReceipt(receipt, true);
    }

    if (result.status !== 0) {
      console.error('[apple-iap] Verification failed, status:', result.status);
      return res.status(400).json({ error: 'Receipt verification failed', appleStatus: result.status });
    }

    // Find the latest receipt info for this product
    const latestReceipts = result.latest_receipt_info || [];
    const matchingReceipt = latestReceipts.find((r: any) => r.product_id === productId);

    if (!matchingReceipt) {
      return res.status(400).json({ error: 'No matching subscription found in receipt' });
    }

    // Check if subscription is still active
    const expiresMs = parseInt(matchingReceipt.expires_date_ms, 10);
    if (expiresMs < Date.now()) {
      return res.status(400).json({ error: 'Subscription has expired' });
    }

    const orderId = String(matchingReceipt.original_transaction_id || '');
    if (!orderId) {
      return res.status(400).json({ error: 'Missing original transaction id' });
    }
    const existingApplePurchase = await prisma.transactionLog.findFirst({
      where: {
        order_id: orderId,
        transaction_type: 'SUBSCRIPTION_PURCHASE',
        status: 'COMPLETED',
      } as any,
      select: { user_id: true },
    });
    if (existingApplePurchase?.user_id && existingApplePurchase.user_id !== userId) {
      return res.status(409).json({ error: 'Receipt already used by another account' });
    }
    if (existingApplePurchase?.user_id === userId) {
      return res.json({
        ok: true,
        plan,
        expires: new Date(expiresMs).toISOString(),
        idempotent: true,
      });
    }

    // Update user's plan in database
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, email: true } });
    const currentPrefs = (user?.preferences && typeof user.preferences === 'object') ? user.preferences as any : {};

    // Rule A: Clear pending_plan, payment_pending, payment_approved after successful payment
    const { payment_pending, payment_approved, pending_plan, join_request_pending, ...restPrefs } = currentPrefs;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          subscription_tier: plan === 'legend' ? 'pro' : 'premium',
          subscription_status: 'active',
          preferences: {
            ...restPrefs,
            plan,
            pending_plan: null,
            payment_pending: false,
            apple_product_id: productId,
            apple_original_transaction_id: matchingReceipt.original_transaction_id,
            apple_expires_date: new Date(expiresMs).toISOString(),
          } as any,
        },
      }),
      prisma.transactionLog.create({
        data: {
          transaction_type: 'SUBSCRIPTION_PURCHASE',
          status: 'COMPLETED',
          user_id: userId,
          order_id: orderId,
          metadata: { source: 'apple_iap', productId, plan },
        } as any,
      }),
    ]);

    // Send confirmation email
    if (user?.email) {
      sendBillingNoticeEmail({
        to: user.email,
        type: 'payment_succeeded',
        planName: plan.charAt(0).toUpperCase() + plan.slice(1),
        amount: 'Purchased via Apple',
        manageLink: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/settings/manage-subscription`,
      }).catch(err => captureException(err as Error, { context: 'apple_iap_confirmation_email' }));
    }

    debugLog('apple-iap', `User ${userId} subscribed to ${plan} via Apple IAP`);

    return res.json({
      ok: true,
      plan,
      expires: new Date(expiresMs).toISOString(),
    });
  } catch (err: any) {
    console.error('[apple-iap] verify-receipt error:', err);
    captureException(err, { tags: { context: 'apple-iap-verify' } });
    return res.status(500).json({ error: 'Receipt verification failed' });
  }
}));

// Apple IAP ad receipt verification (consumable products: MOND_THURS, FRI_SUN)
paymentsRouter.post('/apple/verify-ad-receipt', expressPkg.json(), requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!APPLE_SHARED_SECRET) {
      return res.status(503).json({ error: 'IAP verification not configured. Please contact support.' });
    }
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const appleAdReceiptSchema = z.object({
      ad_id: z.string().min(1),
      dates: z.array(z.string()).min(1),
      receipts: z.array(z.object({
        receipt: z.string().min(1),
        productId: z.string().min(1),
        quantity: z.number().optional(),
      })).min(1),
    });
    const parsed = appleAdReceiptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { ad_id, dates, receipts } = parsed.data;

    const isoDateStrings: string[] = dates.map((d: any) => String(d));
    // Enforce booking horizon — no dates beyond 56 days from today
    const MAX_BOOKING_HORIZON_DAYS = 56;
    const horizonCutoff = new Date();
    horizonCutoff.setDate(horizonCutoff.getDate() + MAX_BOOKING_HORIZON_DAYS);
    const pastHorizon = isoDateStrings.filter(d => new Date(d + 'T00:00:00.000Z') > horizonCutoff);
    if (pastHorizon.length > 0) {
      return res.status(400).json({ error: `Dates must be within ${MAX_BOOKING_HORIZON_DAYS} days from today`, dates: pastHorizon });
    }

    const ad = await prisma.ad.findUnique({ where: { id: String(ad_id) } });
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
    if (ad.status !== 'approved' && ad.status !== 'active') {
      return res.status(403).json({ error: 'Ad must be approved before payment' });
    }

    const expectedPricing = calculateAdPriceCents(dates);
    let verifiedCents = 0;
    const orderIds: string[] = [];

    for (const r of receipts) {
      const { receipt, productId, quantity } = r;
      if (!receipt || !productId || !(APPLE_AD_PRODUCTS as readonly string[]).includes(productId)) {
        return res.status(400).json({ error: `Invalid receipt: unknown product ${productId}` });
      }
      const unitCents = AD_PRODUCT_CENTS[productId];
      if (!unitCents) return res.status(400).json({ error: `Unknown ad product: ${productId}` });

      let result = await verifyAppleReceipt(receipt, false);
      if (result.status === 21007) result = await verifyAppleReceipt(receipt, true);
      if (result.status !== 0) {
        return res.status(400).json({ error: 'Receipt verification failed', appleStatus: result.status });
      }

      const inApp = result.receipt?.in_app || [];
      const matching = inApp.filter((t: any) => t.product_id === productId);
      if (matching.length === 0) {
        return res.status(400).json({ error: 'No matching transactions in receipt for product', product_id: productId });
      }
      // Apple consumable IAP with quantity > 1 creates ONE transaction entry with a quantity field,
      // not multiple entries. Use the transaction's quantity, not matching.length.
      const purchasedQty = parseInt(matching[0]?.quantity || '1', 10) || 1;
      verifiedCents += unitCents * purchasedQty;

      const txId = matching[0]?.transaction_id || matching[0]?.original_transaction_id;
      if (txId) orderIds.push(String(txId));
    }

    if (verifiedCents < expectedPricing.totalCents) {
      return res.status(400).json({ error: 'Receipt total does not match expected amount' });
    }

    const orderId = orderIds.join('_') || `ad_iap_${ad_id}_${crypto.randomUUID()}`;
    const existing = await prisma.transactionLog.findFirst({
      where: { order_id: orderId, transaction_type: 'AD_PURCHASE', status: 'COMPLETED' } as any,
    });
    if (existing) {
      return res.json({ ok: true, idempotent: true });
    }

    const MAX_AD_SLOTS = 2;
    if (ad.target_zip_code) {
      const reservedAdsInZip = await prisma.ad.findMany({
        where: {
          target_zip_code: ad.target_zip_code,
          payment_status: { in: ['paid', 'hold', 'pending_approval'] },
          NOT: { id: String(ad_id) },
        },
        select: { id: true },
        take: 100,
      });
      if (reservedAdsInZip.length > 0) {
        const dateObjects = dates.map((s: string) => new Date(s + 'T00:00:00.000Z'));
        const bookedSlots = await prisma.adReservation.groupBy({
          by: ['date'],
          where: { ad_id: { in: reservedAdsInZip.map((a) => a.id) }, date: { in: dateObjects } },
          _count: { date: true },
        });
        const fullDates = bookedSlots.filter((s) => s._count.date >= MAX_AD_SLOTS);
        if (fullDates.length > 0) {
          return res.status(409).json({ error: 'One or more dates are fully booked', dates: fullDates.map((s) => s.date.toISOString().slice(0, 10)) });
        }
      }
    }

    // SECURITY: Only activate ads that have been approved by admin
    if (ad.status !== 'approved' && ad.status !== 'active') {
      return res.status(403).json({ error: 'Ad must be approved before payment', current_status: ad.status });
    }

    await prisma.$transaction([
      prisma.ad.update({
        where: { id: String(ad_id) },
        data: { payment_status: 'paid', status: 'active' },
      }),
      prisma.adReservation.createMany({
        data: dates.map((s: string) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })),
        skipDuplicates: true,
      }),
      prisma.transactionLog.create({
        data: {
          transaction_type: 'AD_PURCHASE',
          status: 'COMPLETED',
          user_id: userId,
          order_id: orderId,
          metadata: { source: 'apple_iap', ad_id: String(ad_id), dates, receipts_count: receipts.length },
        } as any,
      }),
    ]);

    // Ad payment confirmation email removed — non-mandatory

    debugLog('apple-iap-ad', `User ${userId} paid for ad ${ad_id} via Apple IAP`);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[apple-iap] verify-ad-receipt error:', err);
    captureException(err, { tags: { context: 'apple-iap-verify-ad' } });
    return res.status(500).json({ error: 'Receipt verification failed' });
  }
}));

// ── Apple Server-to-Server (S2S) Notifications V2 ──────────────────
// Apple sends JWS-signed payloads for subscription lifecycle events.
// Configure this URL in App Store Connect → App → App Store Server Notifications.
paymentsRouter.post('/apple/notifications', expressPkg.json(), asyncHandler(async (req, res) => {
  try {
    const { signedPayload } = req.body || {};
    if (!signedPayload) {
      console.warn('[apple-s2s] Missing signedPayload');
      return res.sendStatus(200); // Always 200 to Apple
    }

    // Verify JWS signature using the x5c certificate chain from the header.
    // The leaf cert signs the payload; we verify the chain against Apple's root CA.
    let payload: any;
    try {
      // Step 1: Decode header WITHOUT verification to inspect x5c chain
      const decoded = jwt.decode(signedPayload, { complete: true });
      const header = decoded?.header as any;
      if (!header?.x5c?.length) {
        console.error('[apple-s2s] No x5c certificate chain in JWS header — rejecting unverified payload');
        return res.status(400).json({ error: 'Missing certificate chain' });
      }

      // Step 2: Enforce ES256 algorithm — reject anything else
      if (header.alg !== 'ES256') {
        console.error('[apple-s2s] Unexpected algorithm:', header.alg, '— only ES256 is accepted');
        return res.status(403).json({ error: 'Invalid algorithm' });
      }

      // Step 3: Build PEM certs from x5c chain
      const x5cCerts = (header.x5c as string[]).map(
        (c: string) => `-----BEGIN CERTIFICATE-----\n${c}\n-----END CERTIFICATE-----`
      );
      const leafCertPem = x5cCerts[0];

      // Step 4: Pin root cert to Apple Root CA - G3
      // Apple's App Store S2S notifications always chain to "Apple Root CA - G3"
      const rootCert = x5cCerts[x5cCerts.length - 1];
      const rootX509 = new crypto.X509Certificate(rootCert);
      // Check CN and O fields for Apple Root CA identity
      if (!rootX509.subject.includes('Apple Root CA') || !rootX509.issuer.includes('Apple Root CA')) {
        console.error('[apple-s2s] Root cert is NOT Apple Root CA — rejecting. Subject:', rootX509.subject, 'Issuer:', rootX509.issuer);
        return res.status(403).json({ error: 'Invalid certificate chain' });
      }
      // Verify root is self-signed
      if (!rootX509.checkIssued(rootX509)) {
        console.error('[apple-s2s] Root cert is not self-signed — rejecting');
        return res.status(403).json({ error: 'Invalid root certificate' });
      }

      // Step 5: Verify full chain — each cert issued by the next
      for (let i = 0; i < x5cCerts.length - 1; i++) {
        const cert = new crypto.X509Certificate(x5cCerts[i]);
        const issuerCert = new crypto.X509Certificate(x5cCerts[i + 1]);
        if (!cert.checkIssued(issuerCert)) {
          console.error(`[apple-s2s] Certificate chain broken at index ${i} — rejecting`);
          return res.status(403).json({ error: 'Broken certificate chain' });
        }
      }

      // Step 6: Verify JWS signature with leaf cert public key — strict ES256 only
      const leafCert = crypto.createPublicKey(leafCertPem);
      payload = jwt.verify(signedPayload, leafCert, { algorithms: ['ES256'] });
    } catch (decodeErr) {
      console.error('[apple-s2s] Failed to verify/decode signedPayload:', decodeErr);
      return res.sendStatus(200);
    }

    if (!payload) {
      console.error('[apple-s2s] Decoded payload is null');
      return res.sendStatus(200);
    }

    // Step 7: Validate payload claims — bundleId and environment
    const EXPECTED_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.varsithub.varsityhub-ios';
    const data = payload.data || {};
    const notificationType: string = payload.notificationType || '';
    const subtype: string = payload.subtype || '';

    // Verify bundleId matches our app (prevents cross-app replay)
    if (data.bundleId && data.bundleId !== EXPECTED_BUNDLE_ID) {
      console.error('[apple-s2s] bundleId mismatch:', data.bundleId, 'expected:', EXPECTED_BUNDLE_ID);
      return res.status(403).json({ error: 'Bundle ID mismatch' });
    }

    // Reject sandbox notifications in production (optional safety check)
    const environment: string = data.environment || payload.environment || 'Production';
    if (process.env.NODE_ENV === 'production' && environment === 'Sandbox') {
      console.warn('[apple-s2s] Rejecting sandbox notification in production');
      return res.sendStatus(200);
    }

    // Verify inner JWS tokens using their own x5c certificate chains (Apple best practice).
    // Falls back to jwt.decode if verification fails — the outer payload was already verified.
    const verifyInnerJWS = (token: string): any => {
      try {
        const innerHeader = jwt.decode(token, { complete: true })?.header as any;
        if (innerHeader?.x5c?.length) {
          const innerCertPem = `-----BEGIN CERTIFICATE-----\n${innerHeader.x5c[0]}\n-----END CERTIFICATE-----`;
          const innerKey = crypto.createPublicKey(innerCertPem);
          return jwt.verify(token, innerKey, { algorithms: ['ES256'] });
        }
      } catch { /* fall through to decode */ }
      return jwt.decode(token) || {};
    };

    let transactionInfo: any = {};
    if (data.signedTransactionInfo) {
      transactionInfo = verifyInnerJWS(data.signedTransactionInfo);
    }

    let renewalInfo: any = {};
    if (data.signedRenewalInfo) {
      renewalInfo = verifyInnerJWS(data.signedRenewalInfo);
    }

    const originalTransactionId: string = transactionInfo.originalTransactionId || '';
    const productId: string = transactionInfo.productId || '';
    const expiresDate: number = transactionInfo.expiresDate || 0; // ms timestamp

    console.log('[apple-s2s] Notification received:', {
      notificationType,
      subtype,
      originalTransactionId,
      productId,
      environment,
    });

    // Audit log — always log the notification regardless of whether we find a user
    await prisma.transactionLog.create({
      data: {
        transaction_type: 'APPLE_S2S_NOTIFICATION',
        status: 'RECEIVED',
        order_id: originalTransactionId || `s2s_${Date.now()}`,
        metadata: {
          notificationType,
          subtype,
          originalTransactionId,
          productId,
          environment,
          expiresDate: expiresDate ? new Date(expiresDate).toISOString() : null,
        },
      },
    }).catch(err => console.error('[apple-s2s] Failed to log notification:', err));

    if (!originalTransactionId) {
      console.warn('[apple-s2s] No originalTransactionId — cannot match user');
      return res.sendStatus(200);
    }

    // Find user by apple_original_transaction_id stored in preferences JSON
    // Uses PostgreSQL JSON path query — exact match, indexed, no LIKE needed
    const matchedUser = await prisma.user.findFirst({
      where: {
        preferences: {
          path: ['apple_original_transaction_id'],
          equals: originalTransactionId,
        },
      },
      select: { id: true, preferences: true },
    });

    if (!matchedUser) {
      console.warn('[apple-s2s] No user found for originalTransactionId:', originalTransactionId);
      return res.sendStatus(200);
    }

    const userId: string = matchedUser.id;
    const prefs = (matchedUser.preferences && typeof matchedUser.preferences === 'object')
      ? matchedUser.preferences as any
      : {};

    debugLog('apple-s2s', `Processing ${notificationType}/${subtype} for user ${userId}`);

    // ── Handle notification types ──
    if (
      notificationType === 'DID_RENEW' ||
      notificationType === 'SUBSCRIBED'
    ) {
      // Renewal or new subscription — activate and extend expiry
      const plan = APPLE_PRODUCT_TO_PLAN[productId] || prefs.plan || 'veteran';
      const newExpiry = expiresDate ? new Date(expiresDate).toISOString() : prefs.apple_expires_date;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            subscription_tier: plan === 'legend' ? 'pro' : 'premium',
            subscription_status: 'active',
            preferences: {
              ...prefs,
              plan,
              apple_expires_date: newExpiry,
              apple_original_transaction_id: originalTransactionId,
            } as any,
          },
        }),
        prisma.transactionLog.create({
          data: {
            transaction_type: 'SUBSCRIPTION_RENEWAL',
            status: 'COMPLETED',
            user_id: userId,
            order_id: originalTransactionId,
            metadata: { source: 'apple_s2s', notificationType, subtype, productId, plan },
          } as any,
        }),
      ]);
      debugLog('apple-s2s', `User ${userId} renewed/subscribed — plan: ${plan}`);

    } else if (
      notificationType === 'DID_FAIL_TO_RENEW' ||
      (notificationType === 'GRACE_PERIOD' || subtype === 'GRACE_PERIOD')
    ) {
      // v1.0.2 pass 8: previously we marked past_due but never recorded WHEN the grace period
      // expires. If Apple's EXPIRED notification was lost (network failure, missed delivery),
      // the user kept Premium access indefinitely. Now we record an explicit cutoff so a
      // safety net check (in requireOnboarded or middleware) can downgrade users whose
      // grace period has elapsed without an EXPIRED arriving.
      const APPLE_GRACE_PERIOD_MS = 16 * 24 * 60 * 60 * 1000; // Apple billing grace ≈ 16 days
      const graceExpiresAt = new Date(Date.now() + APPLE_GRACE_PERIOD_MS);
      const updatedPrefs = { ...prefs, grace_period_expires_at: graceExpiresAt.toISOString() };
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            subscription_status: 'past_due',
            preferences: updatedPrefs,
          },
        }),
        prisma.transactionLog.create({
          data: {
            transaction_type: 'SUBSCRIPTION_RENEWAL_FAILED',
            status: 'FAILED',
            user_id: userId,
            order_id: originalTransactionId,
            metadata: { source: 'apple_s2s', notificationType, subtype, grace_expires_at: graceExpiresAt.toISOString() },
          },
        }),
      ]);
      console.warn('[apple-s2s] Marked user as past_due with grace period expiry:', { userId, graceExpiresAt });

    } else if (
      notificationType === 'EXPIRED' ||
      notificationType === 'REVOKE' ||
      notificationType === 'REFUND'
    ) {
      // Expired, revoked, or refunded — downgrade to rookie
      const previousPlan = prefs.plan || 'rookie';
      const downgradedPrefs = { ...prefs };
      downgradedPrefs.plan = 'rookie';
      delete downgradedPrefs.apple_product_id;
      delete downgradedPrefs.apple_expires_date;
      // Keep apple_original_transaction_id for audit trail

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            subscription_tier: 'free',
            subscription_status: 'canceled',
            preferences: downgradedPrefs as any,
          },
        }),
        prisma.transactionLog.create({
          data: {
            transaction_type: 'SUBSCRIPTION_CANCEL',
            status: 'COMPLETED',
            user_id: userId,
            order_id: originalTransactionId,
            metadata: {
              source: 'apple_s2s',
              notificationType,
              subtype,
              reason: notificationType.toLowerCase(),
              previous_plan: previousPlan,
            },
          } as any,
        }),
      ]);
      debugLog('apple-s2s', `User ${userId} downgraded to rookie — reason: ${notificationType}`);

      // Send billing notice for cancellation/refund
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email) {
        sendBillingNoticeEmail({
          to: user.email,
          type: 'subscription_canceled',
          planName: previousPlan.charAt(0).toUpperCase() + previousPlan.slice(1),
        }).catch(err => captureException(err as Error, { context: 'apple_s2s_cancel_email' }));
      }
    } else {
      debugLog('apple-s2s', `Unhandled notification type: ${notificationType}/${subtype} for user ${userId}`);
    }

    return res.sendStatus(200);
  } catch (err: any) {
    console.error('[apple-s2s] Error processing notification:', err);
    captureException(err, { tags: { context: 'apple-s2s-notification' } });
    // Always return 200 so Apple doesn't retry indefinitely
    return res.sendStatus(200);
  }
}));

// ── Google Play Billing verification ────────────────────────────────
const GOOGLE_PRODUCT_TO_PLAN: Record<string, string> = {
  MIDTIER: 'veteran',
  TOPTIER: 'legend',
};
const GOOGLE_ALLOWED_PACKAGES = (process.env.GOOGLE_PLAY_PACKAGE_NAMES || 'com.varsityhub.varsityhub')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const GOOGLE_PLAY_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const GOOGLE_PLAY_API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || '').trim();
const GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY || '')
  .replace(/\\n/g, '\n')
  .trim();
const GOOGLE_PLAY_STRICT_VERIFY = process.env.GOOGLE_PLAY_STRICT_VERIFY === '1';
const GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK = process.env.GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK === '1';

// M3: Fail loud in production if Google Play verification is not configured and fallback is enabled.
// A missing env var + fallback flag = anyone can claim a purchase without store verification.
if (process.env.NODE_ENV === 'production' && GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK) {
  console.error('[SECURITY] GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK=1 is set in production. ' +
    'This allows unverified purchase claims. Remove this env var or set GOOGLE_PLAY_STRICT_VERIFY=1.');
  if (!GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('[FATAL] Google Play fallback mode enabled in production without service account credentials. ' +
      'Either configure GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL + GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY, ' +
      'or remove GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK.');
  }
}

function hasGooglePlayVerifierConfig() {
  return Boolean(GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL && GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY);
}

async function getGooglePlayAccessToken(): Promise<string | null> {
  if (!hasGooglePlayVerifierConfig()) return null;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
      scope: GOOGLE_PLAY_SCOPE,
      aud: GOOGLE_PLAY_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY,
    { algorithm: 'RS256' }
  );

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const response = await fetch(GOOGLE_PLAY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Google token exchange failed (${response.status}): ${text || 'no response body'}`);
  }
  const payload: any = await response.json();
  return typeof payload?.access_token === 'string' ? payload.access_token : null;
}

async function verifyGooglePurchaseWithPlayApi(params: {
  packageName: string;
  productId: string;
  purchaseToken: string;
}) {
  const accessToken = await getGooglePlayAccessToken();
  if (!accessToken) {
    return { verified: false as const, reason: 'google_verifier_not_configured' };
  }

  const { packageName, productId, purchaseToken } = params;
  const url = `${GOOGLE_PLAY_API_BASE}/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      verified: false as const,
      reason: `google_play_api_${response.status}`,
      details: text || null,
    };
  }

  const payload: any = await response.json();
  const expiryTimeMillis = Number(payload?.expiryTimeMillis || 0);
  const cancelReason = payload?.cancelReason;
  const isExpired = !expiryTimeMillis || expiryTimeMillis <= Date.now();
  const isCanceled = cancelReason !== undefined && cancelReason !== null;
  if (isExpired || isCanceled) {
    return {
      verified: false as const,
      reason: isExpired ? 'google_subscription_expired' : 'google_subscription_canceled',
      details: payload,
    };
  }

  return {
    verified: true as const,
    expiresAt: new Date(expiryTimeMillis).toISOString(),
    details: payload,
  };
}

// Google Play purchase verification
paymentsRouter.post('/google/verify-purchase', expressPkg.json(), requireVerified as any, paymentLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const googlePurchaseSchema = z.object({
      purchase_token: z.string().min(16, 'Invalid purchase_token'),
      product_id: z.string().min(1),
      package_name: z.string().optional(),
    });
    const parsed = googlePurchaseSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten().fieldErrors });
    const { purchase_token, product_id, package_name } = parsed.data;

    const plan = GOOGLE_PRODUCT_TO_PLAN[product_id];
    if (!plan) {
      return res.status(400).json({ error: `Unknown product: ${product_id}` });
    }

    if (process.env.NODE_ENV === 'production') {
      if (!package_name) {
        return res.status(400).json({ error: 'Missing package_name' });
      }
      if (GOOGLE_ALLOWED_PACKAGES.length > 0 && !GOOGLE_ALLOWED_PACKAGES.includes(String(package_name))) {
        return res.status(400).json({ error: 'Package mismatch for Google Play purchase' });
      }
    }

    const orderId = String(purchase_token).substring(0, 40);
    const existingCompletedPurchase = await prisma.transactionLog.findFirst({
      where: {
        order_id: orderId,
        transaction_type: 'SUBSCRIPTION_PURCHASE',
        status: 'COMPLETED',
      } as any,
      select: { id: true, user_id: true },
    });
    if (existingCompletedPurchase) {
      if (existingCompletedPurchase.user_id === userId) {
        return res.json({ ok: true, plan, idempotent: true, verified: false });
      }
      return res.status(409).json({ error: 'Purchase token already used by another account' });
    }

    const packageForVerification = String(package_name || GOOGLE_ALLOWED_PACKAGES[0] || '').trim();
    let verifiedByStore = false;
    let verificationMode: 'google_play_api' | 'client_fallback' = 'client_fallback';
    if (hasGooglePlayVerifierConfig()) {
      const verifyResult = await verifyGooglePurchaseWithPlayApi({
        packageName: packageForVerification,
        productId: String(product_id),
        purchaseToken: String(purchase_token),
      });
      if (!verifyResult.verified) {
        return res.status(400).json({
          error: 'Google Play purchase verification failed',
          reason: verifyResult.reason,
        });
      }
      verifiedByStore = true;
      verificationMode = 'google_play_api';
    } else if (GOOGLE_PLAY_STRICT_VERIFY || (process.env.NODE_ENV === 'production' && !GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK)) {
      return res.status(503).json({ error: 'Google Play verification not configured on server' });
    } else {
      console.warn('[google-iap] Proceeding without Play API verification (fallback mode enabled)');
    }

    // Update user's plan in database
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, email: true } });
    const currentPrefs = (user?.preferences && typeof user.preferences === 'object') ? user.preferences as any : {};

    // Clear pending flags after successful payment (same as Apple flow)
    const { payment_pending, payment_approved, pending_plan, join_request_pending, ...restPrefs } = currentPrefs;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          subscription_tier: plan === 'legend' ? 'pro' : 'premium',
          subscription_status: 'active',
          preferences: {
            ...restPrefs,
            plan,
            pending_plan: null,
            payment_pending: false,
            google_purchase_token: purchase_token,
            google_product_id: product_id,
            subscription_platform: 'google',
          } as any,
        },
      }),
      prisma.transactionLog.create({
        data: {
          transaction_type: 'SUBSCRIPTION_PURCHASE',
          status: 'COMPLETED',
          user_id: userId,
          order_id: orderId,
          metadata: { source: 'google_play', product_id, plan, package_name, verified_by_store: verifiedByStore, verification_mode: verificationMode },
        } as any,
      }),
    ]);

    // Send confirmation email
    if (user?.email) {
      sendBillingNoticeEmail({
        to: user.email,
        type: 'payment_succeeded',
        planName: plan.charAt(0).toUpperCase() + plan.slice(1),
        amount: 'Purchased via Google Play',
        manageLink: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/settings/manage-subscription`,
      }).catch(err => captureException(err as Error, { context: 'google_iap_confirmation_email' }));
    }

    debugLog('google-iap', `User ${userId} subscribed to ${plan} via Google Play Billing`);

    return res.json({ ok: true, plan, verified: verifiedByStore });
  } catch (err: any) {
    console.error('[google-iap] verify-purchase error:', err);
    captureException(err, { tags: { context: 'google-iap-verify' } });
    return res.status(500).json({ error: 'Verification failed' });
  }
}));

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

// Test-only internals for finalize-session verification.
export const __paymentsInternal = {
  finalizeFromSession,
  runFinalizeFromSession,
};
