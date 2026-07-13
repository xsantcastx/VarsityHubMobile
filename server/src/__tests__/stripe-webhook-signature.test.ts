/**
 * Stripe webhook signature rejection — real HTTP test.
 *
 * payments-invariants.test.ts already verifies that the route source
 * MENTIONS stripe.webhooks.constructEvent. That's a static scan; a
 * future refactor that swallows or short-circuits the signature check
 * would still pass that grep.
 *
 * This test boots the route over real HTTP and:
 *   1. POSTs without a stripe-signature header → expects 400
 *   2. POSTs with a present-but-tampered signature → expects 400
 *   3. POSTs with no STRIPE_WEBHOOK_SECRET configured → expects 500
 *
 * Mirrors index.ts's raw-body wiring: express.raw({type:'application/json'})
 * MUST be mounted on /payments/webhook BEFORE express.json(), otherwise
 * constructEvent fails differently (body-not-Buffer) and the test would
 * be measuring the wrong failure mode.
 */

import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { paymentsRouter } from '../routes/payments.js';

const ORIGINAL_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function buildWebhookOnlyApp() {
  const app = express();
  // Raw-body parser for the webhook route ONLY — must run before any json parser.
  app.use('/payments/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use('/payments', paymentsRouter);
  return app;
}

describe('Stripe webhook signature verification', () => {
  beforeAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_for_signature_verification';
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_for_signature_verification';
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_SECRET;
    }
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(buildWebhookOnlyApp())
      .post('/payments/webhook')
      .set('content-type', 'application/json')
      .send(Buffer.from('{"id":"evt_test","type":"test.event"}'));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing stripe-signature header' });
  });

  it('returns 400 when stripe-signature is present but tampered', async () => {
    // A real signature has shape `t=<timestamp>,v1=<hmac-sha256>`. We send a
    // syntactically-valid header with a hash that wasn't produced by our test
    // secret — Stripe SDK's constructEvent will compute the expected HMAC,
    // compare, fail, throw. Handler must catch and return 400.
    const tamperedSig =
      't=1735000000,v1=0000000000000000000000000000000000000000000000000000000000000000';

    const res = await request(buildWebhookOnlyApp())
      .post('/payments/webhook')
      .set('content-type', 'application/json')
      .set('stripe-signature', tamperedSig)
      .send(Buffer.from('{"id":"evt_test","type":"test.event"}'));

    expect(res.status).toBe(400);
    expect(res.text).toContain('Invalid signature');
  });

  it('returns 500 when STRIPE_WEBHOOK_SECRET is unset (server misconfigured)', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const res = await request(buildWebhookOnlyApp())
      .post('/payments/webhook')
      .set('content-type', 'application/json')
      .set('stripe-signature', 't=1735000000,v1=anything')
      .send(Buffer.from('{"id":"evt_test","type":"test.event"}'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Webhook verification failed — server misconfigured' });
  });
});
