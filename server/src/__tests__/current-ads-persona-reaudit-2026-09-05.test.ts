/** Current audit: real JWT/HTTP/PostgreSQL; only Stripe transport is a local stub. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHmac } from 'node:crypto';
import express from 'express';
import Stripe from 'stripe';
import request from 'supertest';

const runId = String(Date.now());
const webhookSecret = 'whsec_current_ads_persona_local_only';
const sessions = new Map<string, any>();
const intents = new Map<string, any>();
const createSession = jest.fn(async (params: any) => {
  const id = `cs_current_${runId}_${sessions.size}`;
  const session = {
    ...params,
    id,
    url: `https://checkout.example.test/${id}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
  sessions.set(id, session);
  return session;
});
const createIntent = jest.fn(async (params: any) => {
  const id = `pi_current_${runId}_${intents.size}`;
  const intent = {
    ...params,
    id,
    client_secret: `${id}_secret_fixture`,
    status: 'requires_payment_method',
  };
  intents.set(id, intent);
  return intent;
});
let customerSequence = 0;
const createCustomer = jest.fn(async () => ({ id: `cus_current_${runId}_${++customerSequence}` }));
const createEphemeral = jest.fn(async () => ({ secret: 'ek_fixture' }));
jest.unstable_mockModule('stripe', () => ({
  default: class LocalStripe extends Stripe {
    constructor(..._args: any[]) {
      super('sk_test_fixture');
      this.checkout.sessions.create = createSession as any;
      this.checkout.sessions.expire = jest.fn(async () => ({})) as any;
      this.customers.create = createCustomer as any;
      this.ephemeralKeys.create = createEphemeral as any;
      this.paymentIntents.create = createIntent as any;
      this.paymentIntents.retrieve = jest.fn(async (id: string) => intents.get(id)) as any;
      this.paymentIntents.cancel = jest.fn(async (id: string) => {
        intents.get(id).status = 'canceled';
        return intents.get(id);
      }) as any;
    }
  },
}));

let prisma: any;
let app: express.Express;
let founder: any;
const personas: Record<string, any> = {};
const userIds: string[] = [];
const adIds: string[] = [];
const orgIds: string[] = [];
const eventIds: string[] = [];
const dates = [1, 2, 3].map(days =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
);

beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL || '');
  if (db.hostname !== '127.0.0.1' || !db.pathname.startsWith('/varsityhub_audit_vh_reaudit_ads_')) {
    throw new Error('Requires the dedicated current ad audit database');
  }
  process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  ({ prisma } = await import('../lib/prisma.js'));
  await import('../lib/adInventory.js');
  await import('../lib/paymentInternals.js');
  const { app: adsApp } = await import('../adApprovalTestApp.js');
  const { paymentsRouter } = await import('../routes/payments.js');
  const { authMiddleware } = await import('../middleware/auth.js');
  const { signJwt } = await import('../lib/jwt.js');
  app = express();
  app.use('/payments/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/payments', paymentsRouter);
  app.use(adsApp);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  for (const name of ['fan', 'coach', 'organizer', 'unverified']) {
    const user = await prisma.user.create({
      data: {
        email: `current-ad-${name}-${runId}@example.test`,
        password_hash: 'fixture-no-login',
        email_verified: name !== 'unverified',
        role: name === 'coach' || name === 'organizer' ? 'coach' : 'fan',
        approval_status: 'APPROVED',
        onboarding_completed: true,
        plan: 'rookie',
        preferences: {
          role: name === 'coach' || name === 'organizer' ? 'coach' : 'fan',
          onboarding_completed: true,
        },
      },
    });
    userIds.push(user.id);
    personas[name] = { ...user, token: signJwt({ id: user.id }) };
  }
  const org = await prisma.organization.create({
    data: {
      name: `Current audit ${runId}`,
      league_owner_id: personas.organizer.id,
      admin_approved: true,
    },
  });
  orgIds.push(org.id);
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: personas.organizer.id, role: 'owner' },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'emancero@varsityhub.app' },
    update: { email_verified: true },
    create: {
      email: 'emancero@varsityhub.app',
      password_hash: 'fixture-no-login',
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
    },
  });
  founder = { ...admin, token: signJwt({ id: admin.id }) };
});

beforeEach(async () => {
  jest.clearAllMocks();
  const { paymentLimiter, adCreationLimiter, adModerationLimiter } =
    await import('../middleware/rateLimiters.js');
  for (const id of [...userIds, founder?.id].filter(Boolean)) {
    paymentLimiter.resetKey(`user:${id}`);
    adCreationLimiter.resetKey(`user:${id}`);
    adModerationLimiter.resetKey(`user:${id}`);
  }
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.processedStripeEvent.deleteMany({ where: { event_id: { in: eventIds } } });
  await prisma.ad.deleteMany({ where: { id: { in: adIds } } });
  await prisma.transactionLog.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

function api(persona: any, method: 'get' | 'post' | 'put' | 'delete', path: string, body?: any) {
  return request(app)[method](path).set('Authorization', `Bearer ${persona.token}`).send(body);
}
async function newAd(persona: any, zip = '10001', status = 'approved') {
  const ad = await prisma.ad.create({
    data: { user_id: persona.id, status, payment_status: 'unpaid', target_zip_code: zip },
  });
  adIds.push(ad.id);
  return ad;
}
async function providerEvent(type: string, object: any) {
  const id = `evt_current_${runId}_${eventIds.length}`;
  eventIds.push(id);
  const payload = JSON.stringify({ id, type, data: { object } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return request(app)
    .post('/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', `t=${timestamp},v1=${signature}`)
    .send(payload);
}

describe.each(['fan', 'coach', 'organizer'])(
  'current %s ad persona through actual HTTP/DB',
  name => {
    it('creates own draft without accepting forged owner/payment/approval fields', async () => {
      const persona = personas[name];
      const res = await api(persona, 'post', '/ads', {
        contact_name: 'Local Audit',
        contact_email: persona.email,
        business_name: 'Current audit',
        target_zip_code: '10001',
        user_id: founder.id,
        status: 'active',
        payment_status: 'paid',
      });
      expect(res.status).toBe(201);
      adIds.push(res.body.id);
      expect(res.body).toMatchObject({
        user_id: persona.id,
        status: 'draft',
        payment_status: 'unpaid',
      });
      expect(
        (await api(persona, 'put', `/ads/${res.body.id}`, { description: 'Edited draft' })).status
      ).toBe(200);
      expect(
        (await api(persona, 'post', `/ads/${res.body.id}/submit-for-approval`)).body
      ).toMatchObject({ status: 'pending', payment_status: 'pending_approval' });
      expect(
        (await api(persona, 'post', `/ads/${res.body.id}/review`, { action: 'approve' })).status
      ).toBe(403);
      expect(
        (await api(founder, 'post', `/ads/${res.body.id}/review`, { action: 'approve' })).body
      ).toMatchObject({ status: 'approved', payment_status: 'unpaid' });
    });
    it('cannot read/edit/delete/submit/price/pay for another account ad', async () => {
      const persona = personas[name];
      const foreign = await newAd(personas[name === 'fan' ? 'coach' : 'fan']);
      for (const [method, path, body] of [
        ['get', `/ads/${foreign.id}`],
        ['put', `/ads/${foreign.id}`, { description: 'Forbidden' }],
        ['delete', `/ads/${foreign.id}`],
        ['post', `/ads/${foreign.id}/submit-for-approval`],
        ['get', `/ads/reservations?ad_id=${foreign.id}`],
        ['post', '/payments/ad-quote', { ad_id: foreign.id, dates: [dates[0]] }],
        ['post', '/payments/checkout', { ad_id: foreign.id, dates: [dates[0]] }],
        ['post', '/payments/create-payment-sheet', { ad_id: foreign.id, dates: [dates[0]] }],
      ] as any[])
        expect((await api(persona, method, path, body)).status).toBe(403);
      expect(createSession).not.toHaveBeenCalled();
      expect(createIntent).not.toHaveBeenCalled();
      expect(await prisma.ad.findUnique({ where: { id: foreign.id } })).toMatchObject({
        user_id: foreign.user_id,
        status: 'approved',
      });
    });
    it('cannot pay before platform approval on either Stripe rail', async () => {
      const ad = await newAd(personas[name], '10001', 'pending');
      for (const route of ['checkout', 'create-payment-sheet']) {
        const res = await api(personas[name], 'post', `/payments/${route}`, {
          ad_id: ad.id,
          dates: [dates[0]],
        });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('APPROVAL_REQUIRED');
      }
      expect(createSession).not.toHaveBeenCalled();
      expect(createIntent).not.toHaveBeenCalled();
    });
    it.each(['checkout', 'create-payment-sheet'])(
      'books and settles own approved ad with %s',
      async route => {
        const persona = personas[name];
        const zip = String(
          31000 + ['fan', 'coach', 'organizer'].indexOf(name) * 10 + (route === 'checkout' ? 0 : 1)
        );
        const ad = await newAd(persona, zip);
        const quote = await api(persona, 'post', '/payments/ad-quote', {
          ad_id: ad.id,
          dates: [dates[0]],
          total_cents: 0,
        });
        expect(quote.status).toBe(200);
        expect(quote.body.total_cents).toBeGreaterThan(0);
        const res = await api(persona, 'post', `/payments/${route}`, {
          ad_id: ad.id,
          dates: [dates[0]],
          amount: 0,
          checkout_mode: 'web',
        });
        expect({ status: res.status, error: res.body.error }).toEqual({
          status: 200,
          error: undefined,
        });
        const purchase =
          route === 'checkout' ? [...sessions.values()].at(-1) : [...intents.values()].at(-1);
        expect(
          await prisma.adSlotHold.count({
            where: { ad_id: ad.id, purchase_reference: purchase.id },
          })
        ).toBe(1);
        expect(await prisma.adReservation.count({ where: { ad_id: ad.id } })).toBe(0);
        const event =
          route === 'checkout'
            ? await providerEvent('checkout.session.completed', {
                ...purchase,
                status: 'complete',
                payment_status: 'paid',
                amount_total: quote.body.total_cents,
                customer_details: { email: persona.email },
              })
            : await providerEvent('payment_intent.succeeded', purchase);
        expect(event.status).toBe(200);
        expect(await prisma.ad.findUnique({ where: { id: ad.id } })).toMatchObject({
          status: 'active',
          payment_status: 'paid',
        });
        expect(await prisma.adReservation.findMany({ where: { ad_id: ad.id } })).toEqual([
          expect.objectContaining({ purchase_reference: purchase.id }),
        ]);
        expect(await prisma.adSlotHold.count({ where: { ad_id: ad.id } })).toBe(0);
      }
    );
  }
);

describe('current supplementary ad boundaries', () => {
  it('refunding an earlier purchase preserves an overlapping later paid purchase', async () => {
    const persona = personas.fan;
    const ad = await newAd(persona, '32222');
    const purchases: any[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const checkout = await api(persona, 'post', '/payments/checkout', {
        ad_id: ad.id,
        dates: [dates[1]],
        checkout_mode: 'web',
      }).set('x-idempotency-key', `${runId}-overlap-${attempt}`);
      // Rejecting an already-paid date before another charge is also safe.
      if (attempt === 1 && [400, 409].includes(checkout.status)) {
        expect(JSON.stringify(checkout.body)).toMatch(
          /already.*(?:paid|book)|paid.*date|duplicate.*date/i
        );
        expect(await prisma.adReservation.count({ where: { ad_id: ad.id } })).toBe(1);
        return;
      }
      expect(checkout.status).toBe(200);
      const session = [...sessions.values()].at(-1)!;
      const quote = await api(persona, 'post', '/payments/ad-quote', {
        ad_id: ad.id,
        dates: [dates[1]],
      });
      const purchase = {
        ...session,
        status: 'complete',
        payment_status: 'paid',
        payment_intent: `pi_overlap_${runId}_${attempt}`,
        amount_total: quote.body.total_cents,
      };
      purchases.push(purchase);
      expect((await providerEvent('checkout.session.completed', purchase)).status).toBe(200);
      expect(
        await prisma.transactionLog.findFirst({ where: { stripe_session_id: purchase.id } })
      ).toMatchObject({ status: 'COMPLETED' });
    }
    const refund = await providerEvent('charge.refunded', {
      id: `ch_overlap_${runId}`,
      object: 'charge',
      payment_intent: purchases[0].payment_intent,
      amount: purchases[0].amount_total,
      amount_refunded: purchases[0].amount_total,
      refunded: true,
    });
    expect(refund.status).toBe(200);
    const remaining = await prisma.adReservation.findMany({ where: { ad_id: ad.id } });
    const current = await prisma.ad.findUnique({ where: { id: ad.id } });
    expect({
      paidDates: remaining.length,
      status: current.status,
      payment: current.payment_status,
    }).toEqual({ paidDates: 1, status: 'active', payment: 'paid' });
  });
  it.each([false, true])(
    'a PaymentSheet purchase can be refunded (legacy reference=%s)',
    async legacy => {
      const persona = personas.fan;
      const ad = await newAd(persona, '32223');
      expect(
        (
          await api(persona, 'post', '/payments/create-payment-sheet', {
            ad_id: ad.id,
            dates: [dates[2]],
          })
        ).status
      ).toBe(200);
      const intent = [...intents.values()].at(-1)!;
      expect((await providerEvent('payment_intent.succeeded', intent)).status).toBe(200);
      const tx = await prisma.transactionLog.findFirst({ where: { stripe_session_id: intent.id } });
      if (legacy)
        await prisma.transactionLog.update({
          where: { id: tx.id },
          data: { stripe_payment_intent_id: null },
        });
      const refund = await providerEvent('charge.refunded', {
        id: `ch_pi_${runId}`,
        object: 'charge',
        payment_intent: intent.id,
        amount: intent.amount,
        amount_refunded: intent.amount,
        refunded: true,
      });
      expect({
        paymentIntentReference: tx.stripe_payment_intent_id,
        refundStatus: refund.status,
      }).toEqual({ paymentIntentReference: intent.id, refundStatus: 200 });
      expect(await prisma.transactionLog.findUnique({ where: { id: tx.id } })).toMatchObject({
        status: 'REFUNDED',
        stripe_payment_intent_id: intent.id,
      });
    }
  );
  it.each(['checkout', 'create-payment-sheet'])(
    'rejects a competing unpaid hold on %s',
    async route => {
      const ad = await newAd(personas.fan, '32224');
      const book = (key: string) =>
        api(personas.fan, 'post', `/payments/${route}`, {
          ad_id: ad.id,
          dates: [dates[0]],
          checkout_mode: 'web',
        }).set('x-idempotency-key', `${runId}-${route}-${key}`);
      expect((await book('first')).status).toBe(200);
      const competing = await book('second');
      expect(competing.status).toBe(409);
      expect(competing.body.code).toBe('AD_DATES_ALREADY_BOOKED');
      expect(await prisma.adSlotHold.count({ where: { ad_id: ad.id } })).toBe(1);
      expect(await prisma.adReservation.count({ where: { ad_id: ad.id } })).toBe(0);
    }
  );
  it('unverified account cannot initiate ad payment', async () => {
    const ad = await newAd(personas.unverified, '10001');
    for (const route of ['checkout', 'create-payment-sheet']) {
      expect(
        (
          await api(personas.unverified, 'post', `/payments/${route}`, {
            ad_id: ad.id,
            dates: [dates[0]],
          })
        ).status
      ).toBe(403);
    }
    expect(createSession).not.toHaveBeenCalled();
    expect(createIntent).not.toHaveBeenCalled();
  });
  it('all personas can cancel only their own pending PaymentIntent', async () => {
    const ad = await newAd(personas.fan, '32111');
    expect(
      (
        await api(personas.fan, 'post', '/payments/create-payment-sheet', {
          ad_id: ad.id,
          dates: [dates[0]],
        })
      ).status
    ).toBe(200);
    const intent = [...intents.values()].at(-1)!;
    for (const name of ['coach', 'organizer'])
      expect(
        (
          await api(personas[name], 'post', '/payments/cancel-intent', {
            payment_intent_id: intent.id,
          })
        ).status
      ).toBe(403);
    expect(
      (await api(personas.fan, 'post', '/payments/cancel-intent', { payment_intent_id: intent.id }))
        .body
    ).toEqual({ canceled: true });
    expect(await prisma.adSlotHold.count({ where: { ad_id: ad.id } })).toBe(0);
    expect(
      await prisma.transactionLog.findFirst({ where: { stripe_session_id: intent.id } })
    ).toMatchObject({ status: 'FAILED' });
  });
});
