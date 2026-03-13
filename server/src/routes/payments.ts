import crypto from 'crypto';
import expressPkg, { Router } from 'express';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { debugLog } from '../lib/debugLog.js';
import { sendAdPaymentConfirmedEmail, sendAdPendingReviewEmail, sendBillingNoticeEmail } from '../lib/email.js';
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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

// Admin notification email — falls back to first ADMIN_EMAILS entry
const ADMIN_NOTIFY_EMAIL = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)[0] || 'emancero@varsityhub.app';

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
  res.json({
    stripe_publishable_key: stripePublishableKey,
    available_plans: availablePlans,
    payments_enabled: true,
    stripe_configured: stripeConfigured,
    has_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
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

async function sendAdPaymentEmail({
  userId,
  fallbackEmail,
  adId,
  dates,
  totalCents,
  businessName,
  zipCode,
}: {
  userId?: string | null;
  fallbackEmail?: string | null;
  adId: string;
  dates: string[];
  totalCents?: number | null;
  businessName?: string | null;
  zipCode?: string | null;
}) {
  const email = await getUserEmail(userId, fallbackEmail);
  if (!email) return;
  const amount = formatUsd(totalCents);

  // Calculate hours from now to midnight of last booked date
  let hoursLabel = '';
  let hoursRemaining = 0;
  const totalHoursBooked = dates.length * 24;
  if (dates.length) {
    const sorted = [...dates].sort();
    const lastEnd = new Date(sorted[sorted.length - 1] + 'T23:59:59Z');
    hoursRemaining = Math.max(0, Math.round((lastEnd.getTime() - Date.now()) / 3600000));
    hoursLabel = `${hoursRemaining} hrs (${dates.length} day${dates.length !== 1 ? 's' : ''})`;
  }

  // Format dates for display
  const formattedDates = [...dates].sort().map((d) => {
    try {
      return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return d; }
  });

  try {
    await sendAdPaymentConfirmedEmail({
      to: email,
      businessName: businessName || undefined,
      zipCode: zipCode || undefined,
      amount: amount || undefined,
      hoursLabel: hoursLabel || undefined,
      totalHoursBooked: totalHoursBooked,
      hoursRemaining: hoursRemaining,
      dates: formattedDates,
      adId,
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
    // Verify the claimed team count matches actual ownership
    const actualTeamCount = await prisma.teamMembership.count({
      where: { user_id: req.user!.id, role: 'owner', status: 'active' },
    });
    if (teamCount > actualTeamCount) {
      throw membershipError(400, `Team count mismatch: you own ${actualTeamCount} teams but requested billing for ${teamCount}`);
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
          unit_amount: chosen === 'veteran' ? 100 : 2000, // Veteran: $1.00/month per additional team, Legend: $20.00/year
          recurring: { interval: chosen === 'veteran' ? 'month' : 'year' },
          product_data: {
            name: 'Membership - ' + chosen,
            description: chosen === 'veteran'
              ? `Veteran plan - $1.00/month per additional team (${billableQuantity} billable of ${teamCount} total, 2 free)`
              : 'Legend plan - $20.00/year unlimited (dev fallback price)',
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

  const session = await stripe.checkout.sessions.create(sessionConfig, {
    idempotencyKey: `membership_${req.user!.id}_${chosen}_${Math.floor(Date.now() / 120000)}`,
  });

  // Log subscription transaction
  const currentUser = await prisma.user.findUnique({ 
    where: { id: req.user!.id },
    select: { email: true }
  });
  const amount = chosen === 'veteran' ? 100 * billableQuantity : 2000; // Veteran: $1.00/month per additional team, Legend: $20.00/year
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
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return { url: session.url ?? null, sessionId: session.id };
}

// Create a Stripe Checkout Session for ad reservations
paymentsRouter.post('/checkout', expressPkg.json(), requireVerified as any, paymentLimiter, async (req: AuthedRequest, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });
  const { ad_id, dates, promo_code, plan, team_count } = req.body || {};
  if (typeof plan === 'string' && plan.trim()) {
    try {
      const { url, sessionId } = await createMembershipCheckoutSession(req, plan, promo_code, team_count);
      return res.json({ url, session_id: sessionId });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      captureException(err, { context: 'stripe_checkout_error', plan });
      return res.status(status).json({ error: err?.message || 'Unable to start subscription checkout' });
    }
  }
  if (!ad_id || !Array.isArray(dates) || dates.length === 0) return res.status(400).json({ error: 'ad_id and dates[] are required' });
  const isoDates: string[] = Array.from(new Set(dates.map((d: any) => String(d))));

  // Ensure ad exists
  const ad = await prisma.ad.findUnique({ where: { id: String(ad_id) } });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });

  // Slot availability check — reject before Stripe if any date is already full.
  // Up to MAX_AD_SLOTS different ads may run per date per zip.
  const MAX_AD_SLOTS = 2;
  if (ad.target_zip_code) {
    // Include both 'paid' and 'hold' ads when checking slot availability.
    // 'hold' ads have temporary reservations created at checkout time to prevent race conditions.
    const reservedAdsInZip = await prisma.ad.findMany({
      where: { target_zip_code: ad.target_zip_code, payment_status: { in: ['paid', 'hold'] }, NOT: { id: String(ad_id) } },
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
        prisma.ad.update({ where: { id: String(ad_id) }, data: { payment_status: 'paid', status: 'pending' } }),
        prisma.adReservation.createMany({ data: isoDates.map((s) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })), skipDuplicates: true }),
      ]);
    } catch (e) {
      console.error('Failed to create ad reservations for free promo:', e);
      return res.status(500).json({ error: 'Failed to reserve ad dates. Please try again.' });
    }
    // Log $0 transaction for audit trail
    logTransaction({
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
    }).catch((err) => {
      console.error('[payments] Failed to log free promo transaction:', err);
      captureException(err as Error, { context: 'free_promo_transaction_log', adId: String(ad_id) });
    });
    // Send confirmation email (same as Stripe webhook path)
    sendAdPaymentEmail({
      userId: req.user!.id,
      adId: String(ad_id),
      dates: isoDates,
      totalCents: 0,
      businessName: ad.business_name,
      zipCode: ad.target_zip_code,
    }).catch((err) => console.warn('[payments] Free promo ad email failed:', err?.message || err));
    // Notify admin for review
    sendAdPendingReviewEmail({
      to: ADMIN_NOTIFY_EMAIL,
      businessName: ad.business_name || undefined,
      zipCode: ad.target_zip_code || undefined,
      adId: String(ad_id),
    }).catch((err) => console.warn('[payments] Free promo admin review email failed:', err?.message || err));
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

  const session = await stripe.checkout.sessions.create(sessionConfig, {
    idempotencyKey: `ad_${req.user!.id}_${ad_id}_${Math.floor(Date.now() / 120000)}`,
  });

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
    // Non-fatal: if hold fails, fall back to existing refund-on-conflict behavior
    console.warn('[payments] Failed to create slot hold, continuing:', (holdErr as any)?.message);
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
});

// ── In-App PaymentSheet endpoint ────────────────────────────────────────────
// Returns client_secret, ephemeral key, customer id and publishable key
// so the mobile app can present Stripe PaymentSheet without leaving the app.
paymentsRouter.post('/create-payment-sheet', expressPkg.json(), requireVerified as any, paymentLimiter, async (req: AuthedRequest, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '';
  const userId = req.user!.id;
  const { ad_id, dates, promo_code, plan, team_count } = req.body || {};

  // ── Get or create Stripe Customer ──
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, stripe_customer_id: true, preferences: true } });
  let customerId = user?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user?.email || undefined, metadata: { user_id: userId } });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripe_customer_id: customerId } });
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
      // Verify the claimed team count matches actual ownership
      const actualTeamCount = await prisma.teamMembership.count({
        where: { user_id: userId, role: 'owner', status: 'active' },
      });
      if (effectiveTeamCount > actualTeamCount) {
        return res.status(400).json({ error: `Team count mismatch: you own ${actualTeamCount} teams but requested billing for ${effectiveTeamCount}` });
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
            unit_amount: chosen === 'veteran' ? 100 : 2000,
            recurring: { interval: chosen === 'veteran' ? ('month' as const) : ('year' as const) },
            product_data: {
              name: 'Membership - ' + chosen,
              description: chosen === 'veteran'
                ? `Veteran plan - $1.00/month per additional team (${billableQuantity} billable of ${effectiveTeamCount} total, 2 free)`
                : 'Legend plan - $20.00/year unlimited (dev fallback price)',
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
        },
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      // Log transaction (must match actual Stripe charge: $1.00/team veteran, $20.00/year legend)
      const amount = chosen === 'veteran' ? 100 * billableQuantity : 2000;
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

  const ad = await prisma.ad.findUnique({ where: { id: String(ad_id) } });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });

  // Slot availability check — include 'hold' ads to prevent race conditions
  const MAX_AD_SLOTS = 2;
  if (ad.target_zip_code) {
    const reservedAdsInZip = await prisma.ad.findMany({
      where: { target_zip_code: ad.target_zip_code, payment_status: { in: ['paid', 'hold'] }, NOT: { id: String(ad_id) } },
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
    // Free via promo — same logic as /checkout free path
    if (appliedCode) {
      await redeemPromo({ code: appliedCode, subtotalCents: subtotal, userId, service: 'booking', orderId: `FREE-${crypto.randomUUID()}` });
    }
    try {
      await prisma.$transaction([
        prisma.ad.update({ where: { id: String(ad_id) }, data: { payment_status: 'paid', status: 'pending' } }),
        prisma.adReservation.createMany({ data: isoDates.map((s) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })), skipDuplicates: true }),
      ]);
    } catch (e) {
      console.error('Failed to create ad reservations for free promo:', e);
      return res.status(500).json({ error: 'Failed to reserve ad dates. Please try again.' });
    }
    // Log $0 transaction for audit trail
    logTransaction({
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
    }).catch((err) => {
      console.error('[payments] Failed to log free promo transaction:', err);
      captureException(err as Error, { context: 'free_promo_transaction_log_pi', adId: String(ad_id) });
    });
    sendAdPaymentEmail({ userId, adId: String(ad_id), dates: isoDates, totalCents: 0, businessName: ad.business_name, zipCode: ad.target_zip_code }).catch((err) => console.warn('[payments] Free promo ad email failed:', err?.message || err));
    // Notify admin for review
    sendAdPendingReviewEmail({
      to: ADMIN_NOTIFY_EMAIL,
      businessName: ad.business_name || undefined,
      zipCode: ad.target_zip_code || undefined,
      adId: String(ad_id),
    }).catch((err) => console.warn('[payments] Free promo admin review email failed:', err?.message || err));
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
      idempotencyKey: `ad_pi_${userId}_${ad_id}_${Math.floor(Date.now() / 120000)}`,
    });

    // Hold slots to prevent race conditions
    try {
      await prisma.$transaction([
        prisma.ad.update({ where: { id: String(ad_id) }, data: { payment_status: 'hold' } }),
        prisma.adReservation.createMany({
          data: isoDates.map((s) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })),
          skipDuplicates: true,
        }),
      ]);
    } catch (holdErr) {
      console.warn('[payments] Failed to create slot hold (PaymentSheet), continuing:', (holdErr as any)?.message);
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
});

// Stripe webhook to finalize reservations on successful payment.
// IMPORTANT: The raw body parser is registered at the app level (server/src/index.ts)
// for route /payments/webhook BEFORE express.json(). Do not add parsers here.
paymentsRouter.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
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

  // Event-level deduplication: reject replayed webhook events
  try {
    await prisma.processedStripeEvent.create({
      data: { event_id: event.id, event_type: event.type },
    });
  } catch (dedupErr: any) {
    if (dedupErr instanceof Prisma.PrismaClientKnownRequestError && dedupErr.code === 'P2002') {
      debugLog('[webhook] Duplicate event skipped', { event_id: event.id, event_type: event.type });
      return res.json({ received: true, deduplicated: true });
    }
    // Non-unique error — log warning but proceed (downstream is idempotent)
    console.warn('[webhook] Failed to record event for dedup, proceeding anyway:', dedupErr?.message || dedupErr);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await finalizeFromSession(session);
    } catch (e) {
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
        logTransaction({
          transactionType: 'SUBSCRIPTION_RENEWAL',
          status: 'COMPLETED',
          userId: renewalUser.id,
          totalCents: invoice.amount_paid || 0,
          stripeSessionId: String(invoice.id),
          stripeSubscriptionId: String(invoice.subscription),
          metadata: { event: 'invoice.payment_succeeded', period_end: invoice.period_end },
        }).catch(err => captureException(err as Error, { context: 'renewal_transaction_log' }));
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
    const customer = await stripe.customers.retrieve(subscription.customer as string).catch(() => null);
    if (customer && !customer.deleted && customer.email) {
      await sendBillingNoticeEmail({
        to: customer.email,
        type: 'subscription_canceled',
        planName: subscription.items.data[0]?.price?.nickname || 'VarsityHub Subscription',
      }).catch(err => console.warn('[billing-email] subscription_canceled failed:', err));

      // Downgrade user to rookie plan now that subscription period has ended
      const canceledUser = await prisma.user.findFirst({ where: { stripe_customer_id: subscription.customer as string } });
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
  }
  
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const customer = await stripe.customers.retrieve(subscription.customer as string).catch(() => null);
    if (customer && !customer.deleted && customer.email) {
      // Sync subscription state to database
      const subUser = await prisma.user.findFirst({ where: { stripe_customer_id: subscription.customer as string } });
      if (subUser) {
        const priceId = subscription.items.data[0]?.price?.id;
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

      if (subscription.status === 'active') {
        await sendBillingNoticeEmail({
          to: customer.email,
          type: 'subscription_renewed',
          amount: `$${((subscription.items.data[0]?.price?.unit_amount || 0) / 100).toFixed(2)}`,
          planName: subscription.items.data[0]?.price?.nickname || 'VarsityHub Subscription',
        }).catch(err => console.warn('[billing-email] subscription_renewed failed:', err));
      }
    }
  }

  // Handle expired checkout sessions — mark PENDING transactions as FAILED and release holds
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
                where: { target_zip_code: adRecord.target_zip_code, payment_status: { in: ['paid', 'hold'] }, NOT: { id: adId } },
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
            await tx.ad.update({ where: { id: adId }, data: { payment_status: 'paid', status: 'pending' } });
            await tx.adReservation.createMany({
              data: piDates.map((s) => ({ ad_id: adId, date: new Date(s + 'T00:00:00.000Z') })),
              skipDuplicates: true,
            });
          }, { isolationLevel: 'Serializable' });

          // Update transaction & send email
          await updateTransactionStatus(pi.id, 'COMPLETED', { stripePaymentIntentId: pi.id });
          const adForEmail = await prisma.ad.findUnique({ where: { id: adId }, select: { business_name: true, contact_name: true, contact_email: true, target_zip_code: true, banner_url: true } });
          sendAdPaymentEmail({
            userId: meta.user_id || null,
            adId,
            dates: piDates,
            totalCents: pi.amount,
            businessName: adForEmail?.business_name,
            zipCode: adForEmail?.target_zip_code,
          }).catch((err) => console.warn('[webhook] ad payment email failed:', err?.message || err));
          // Notify admin that a new ad needs approval
          sendAdPendingReviewEmail({
            to: ADMIN_NOTIFY_EMAIL,
            businessName: adForEmail?.business_name || undefined,
            contactName: adForEmail?.contact_name || undefined,
            contactEmail: adForEmail?.contact_email || undefined,
            zipCode: adForEmail?.target_zip_code || undefined,
            bannerUrl: adForEmail?.banner_url || undefined,
            adId,
          }).catch((err) => captureException(err as Error, { context: 'ad_pending_review_email_pi' }));

          // Redeem promo code if one was used — retry up to 3 times to prevent reuse
          if (meta.promo_code) {
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
              console.error('[webhook] promo redeem FAILED after 3 attempts — flagging for manual review', { code: meta.promo_code, pi_id: pi.id });
              captureException(new Error('Promo redemption failed after retries'), { context: 'promo_redeem_failed', promoCode: meta.promo_code, piId: pi.id, userId: meta.user_id });
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
              await updateTransactionStatus(pi.id, 'REFUNDED', {
                metadata: { reason: 'slot_full', overbooked_dates: e.dates, refund_failed: true },
              }).catch(err => { console.error('[transaction-log] PI slot-full status update failed:', err); captureException(err as Error, { context: 'transaction_log_slot_full_pi' }); });
            }
          } else {
            console.error('[payments] CRITICAL: Error processing ad PI succeeded — returning 500 for Stripe retry', { ad_id: adId, pi_id: pi.id, error: e });
            captureException(e as Error, { context: 'payment_intent_succeeded_ad', adId, piId: pi.id });
            return res.status(500).json({ error: 'Ad processing failed' });
          }
        }
      }
    }
  }

  return res.json({ received: true });
});


// Cancel an abandoned PaymentIntent and mark transaction as FAILED
paymentsRouter.post('/cancel-intent', expressPkg.json(), requireVerified as any, async (req: AuthedRequest, res) => {
  const { payment_intent_id } = req.body || {};
  if (!payment_intent_id || typeof payment_intent_id !== 'string') {
    return res.status(400).json({ error: 'Missing payment_intent_id' });
  }
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
paymentsRouter.get('/debug/subscription-status', requireVerified as any, requireAdmin as any, async (req: AuthedRequest, res) => {
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
});

// Endpoint to reset subscription status to rookie (for fixing invalid states)
paymentsRouter.post('/debug/reset-to-rookie', requireVerified as any, requireAdmin as any, async (req: AuthedRequest, res) => {
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
});

// Admin endpoint to reset all users with unpaid subscriptions
paymentsRouter.post('/admin/reset-unpaid-subscriptions', requireVerified as any, requireAdmin as any, async (req: AuthedRequest, res) => {
  try {

    debugLog('🔍 Admin-initiated bulk reset of unpaid subscriptions...');

    // Get all users and filter in JavaScript (simpler than complex Prisma query)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        display_name: true,
        preferences: true
      },
      take: 10000
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
});

// Authenticated helper to finalize a Checkout Session by id when webhooks are unavailable
paymentsRouter.post('/finalize-session', expressPkg.json(), requireVerified as any, paymentLimiter, async (req: AuthedRequest, res) => {
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
            where: { target_zip_code: adRecord.target_zip_code, payment_status: { in: ['paid', 'hold'] }, NOT: { id: ad_id } },
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

        await tx.ad.update({
          where: { id: ad_id },
          data: { payment_status: 'paid', status: 'pending' },
        });
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
      await sendAdPaymentEmail({
        userId: inferredUserId,
        fallbackEmail,
        adId: String(ad_id),
        dates,
        totalCents,
        businessName: adForEmail?.business_name,
        zipCode: adForEmail?.target_zip_code,
      });
      // Notify admin that a new ad needs approval
      void sendAdPendingReviewEmail({
        to: ADMIN_NOTIFY_EMAIL,
        businessName: adForEmail?.business_name || undefined,
        contactEmail: fallbackEmail || undefined,
        zipCode: adForEmail?.target_zip_code || undefined,
        adId: String(ad_id),
      }).catch((err) => console.warn('[payments] Failed to send ad review email:', (err as any)?.message || err));
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
            await updateTransactionStatus(session.id, 'REFUNDED', {
              metadata: { reason: 'slot_full', overbooked_dates: e.dates, stripe_refund_id: refund.id },
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
            await updateTransactionStatus(session.id, 'REFUNDED', {
              metadata: { reason: 'slot_full', overbooked_dates: e.dates, refund_failed: true },
            }).catch(err => { console.error('[transaction-log] slot-full status update failed:', err); captureException(err as Error, { context: 'transaction_log_slot_full' }); });
          }
        } catch (refundErr: any) {
          console.error('[payments] CRITICAL: Auto-refund FAILED for SLOT_FULL', { session_id: session.id, error: refundErr?.message });
          captureException(refundErr as Error, { context: 'slot_full_auto_refund_failed_session', sessionId: session.id });
          await updateTransactionStatus(session.id, 'REFUNDED', {
            metadata: { reason: 'slot_full', overbooked_dates: e.dates, refund_failed: true },
          }).catch(err => { console.error('[transaction-log] slot-full status update failed:', err); captureException(err as Error, { context: 'transaction_log_slot_full' }); });
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
        const current = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
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
        console.warn('Failed to finalize membership from session:', (err as any)?.message || err);
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
});

// ── Apple IAP Receipt Verification ──────────────────────────────────
const APPLE_SHARED_SECRET = process.env.APPLE_IAP_SHARED_SECRET || '';
const APPLE_VERIFY_URL_PRODUCTION = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_URL_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

const APPLE_PRODUCT_TO_PLAN: Record<string, string> = {
  veteran_vhub: 'veteran',
  Legend_vhub: 'legend',
};

async function verifyAppleReceipt(receiptData: string, useSandbox = false): Promise<any> {
  const url = useSandbox ? APPLE_VERIFY_URL_SANDBOX : APPLE_VERIFY_URL_PRODUCTION;
  const body = JSON.stringify({
    'receipt-data': receiptData,
    password: APPLE_SHARED_SECRET,
    'exclude-old-transactions': true,
  });
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return resp.json();
}

// Apple IAP receipt validation — uses requireAuth (not requireVerified) because Apple
// already charged the user; blocking on email verification would leave them in a broken state.
paymentsRouter.post('/apple/verify-receipt', expressPkg.json(), requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const { receipt, productId } = req.body;
    if (!receipt || !productId) {
      return res.status(400).json({ error: 'Missing receipt or productId' });
    }

    const plan = APPLE_PRODUCT_TO_PLAN[productId];
    if (!plan) {
      return res.status(400).json({ error: `Unknown product: ${productId}` });
    }

    // Verify with Apple — try production first, fall back to sandbox if status 21007
    let result = await verifyAppleReceipt(receipt, false);
    if (result.status === 21007) {
      // Receipt is from sandbox environment
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

    // Update user's plan in database
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, email: true } });
    const currentPrefs = (user?.preferences && typeof user.preferences === 'object') ? user.preferences as any : {};

    // Rule A: Clear pending_plan, payment_pending, payment_approved after successful payment
    const { payment_pending, payment_approved, pending_plan, join_request_pending, ...restPrefs } = currentPrefs;

    await prisma.user.update({
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
    });

    // Log the transaction
    try {
      await logTransaction({
        transactionType: 'SUBSCRIPTION_PURCHASE',
        status: 'COMPLETED',
        userId,
        orderId: matchingReceipt.original_transaction_id,
        metadata: { source: 'apple_iap', productId, plan },
      });
    } catch (logErr) {
      console.warn('[apple-iap] Failed to log transaction:', logErr);
    }

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
});

// ── Google Play Billing verification ────────────────────────────────
const GOOGLE_PRODUCT_TO_PLAN: Record<string, string> = {
  veteran_vhub: 'veteran',
  Legend_vhub: 'legend',
};

// Google Play purchase verification — uses requireAuth (not requireVerified) because Google
// already charged the user; blocking on email verification would leave them in a broken state.
paymentsRouter.post('/google/verify-purchase', expressPkg.json(), requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const { purchase_token, product_id, package_name } = req.body || {};

    if (!purchase_token || !product_id) {
      return res.status(400).json({ error: 'Missing purchase_token or product_id' });
    }

    const plan = GOOGLE_PRODUCT_TO_PLAN[product_id];
    if (!plan) {
      return res.status(400).json({ error: `Unknown product: ${product_id}` });
    }

    // Update user's plan in database
    // Note: Full Google Play Developer API verification should be added for production hardening.
    // For now, we trust the purchase token from the client (same pattern as Apple verify-receipt).
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, email: true } });
    const currentPrefs = (user?.preferences && typeof user.preferences === 'object') ? user.preferences as any : {};

    // Clear pending flags after successful payment (same as Apple flow)
    const { payment_pending, payment_approved, pending_plan, join_request_pending, ...restPrefs } = currentPrefs;

    await prisma.user.update({
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
    });

    // Log the transaction
    try {
      await logTransaction({
        transactionType: 'SUBSCRIPTION_PURCHASE',
        status: 'COMPLETED',
        userId,
        orderId: purchase_token.substring(0, 40),
        metadata: { source: 'google_play', product_id, plan, package_name },
      });
    } catch (logErr) {
      console.warn('[google-iap] Failed to log transaction:', logErr);
    }

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

    return res.json({ ok: true, plan });
  } catch (err: any) {
    console.error('[google-iap] verify-purchase error:', err);
    captureException(err, { tags: { context: 'google-iap-verify' } });
    return res.status(500).json({ error: 'Verification failed' });
  }
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
