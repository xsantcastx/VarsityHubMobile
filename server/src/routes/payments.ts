import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { prisma } from '../lib/prisma.js';
import { previewPromo, redeemPromo } from '../lib/promos.js';
import Stripe from 'stripe';
import expressPkg from 'express';

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

// Create a Stripe Checkout Session for ad reservations
paymentsRouter.post('/checkout', expressPkg.json(), requireVerified as any, async (req: AuthedRequest, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });
  const { ad_id, dates, promo_code } = req.body || {};
  if (!ad_id || !Array.isArray(dates) || dates.length === 0) return res.status(400).json({ error: 'ad_id and dates[] are required' });
  const isoDates: string[] = Array.from(new Set(dates.map((d: any) => String(d))));

  // Ensure ad exists
  const ad = await prisma.ad.findUnique({ where: { id: String(ad_id) } });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });

  // Check conflicts
  const existing = await prisma.adReservation.findMany({ where: { date: { in: isoDates.map((s) => new Date(s + 'T00:00:00.000Z')) } } });
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Dates already reserved', dates: existing.map((r) => r.date.toISOString().slice(0, 10)) });
  }

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

  const appBase = process.env.APP_BASE_URL || (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000');
  const success = `${appBase.replace(/\/$/, '')}/payments/success`;
  const cancel = `${appBase.replace(/\/$/, '')}/payments/cancel`;

  const session = await stripe.checkout.sessions.create({
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
    ],
    // Useful metadata for webhook
    metadata: {
      ad_id: String(ad_id),
      dates: JSON.stringify(isoDates),
      user_id: req.user!.id,
      subtotal_cents: String(amount),
      promo_code: appliedCode || '',
      discount_cents: String(discount || 0),
    },
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
    const meta = session.metadata || {};
    const ad_id = meta.ad_id || '';
    let dates: string[] = [];
    try { dates = JSON.parse(String(meta.dates || '[]')); } catch {}
    if (ad_id && Array.isArray(dates) && dates.length) {
      try {
        await prisma.$transaction([
          prisma.ad.update({ where: { id: ad_id }, data: { payment_status: 'paid' } }),
          prisma.adReservation.createMany({ data: dates.map((s) => ({ ad_id, date: new Date(s + 'T00:00:00.000Z') })), skipDuplicates: true }),
        ]);
      } catch (e) {
        // Ignore conflicts
      }
    }

    // Redeem promo post-payment if present
    const code = (meta.promo_code || '').trim();
    const userId = meta.user_id || '';
    const subtotalCents = Number(meta.subtotal_cents || 0) || 0;
    if (code && userId && subtotalCents > 0) {
      try {
        await redeemPromo({ code, userId, subtotalCents, service: 'booking', orderId: session.id });
      } catch (e) {
        console.warn('Failed to redeem promo in webhook:', (e as any)?.message || e);
      }
    }
  }

  return res.json({ received: true });
});
