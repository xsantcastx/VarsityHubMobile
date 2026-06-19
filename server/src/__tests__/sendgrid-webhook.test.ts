import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';

import { sendgridWebhookRouter } from '../routes/sendgrid-webhook.js';

// Real ECDSA P-256 keypair — mirrors how SendGrid signs the Event Webhook.
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PUBLIC_KEY_B64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

const app = express();
app.use('/webhooks/sendgrid', express.raw({ type: 'application/json' }), sendgridWebhookRouter);

function sign(payload: string, timestamp: string): string {
  const signer = crypto.createSign('sha256');
  signer.update(timestamp + payload);
  signer.end();
  return signer.sign(privateKey).toString('base64');
}

function post(payload: string, signature: string, timestamp: string) {
  return request(app)
    .post('/webhooks/sendgrid')
    .set('Content-Type', 'application/json')
    .set('x-twilio-email-event-webhook-signature', signature)
    .set('x-twilio-email-event-webhook-timestamp', timestamp)
    .send(payload);
}

const ORIGINAL_KEY = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;

describe('SendGrid event webhook', () => {
  beforeAll(() => {
    process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = PUBLIC_KEY_B64;
  });
  afterAll(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
    else process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = ORIGINAL_KEY;
  });
  beforeEach(() => {
    process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = PUBLIC_KEY_B64;
  });

  it('accepts a correctly-signed bounce event (204)', async () => {
    const payload = JSON.stringify([
      { event: 'bounce', email: 'a@b.com', reason: 'mailbox unavailable', sg_event_id: 'evt-1' },
    ]);
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await post(payload, sign(payload, ts), ts);
    expect(res.statusCode).toBe(204);
  });

  it('rejects an invalid signature (403)', async () => {
    const payload = JSON.stringify([{ event: 'bounce', sg_event_id: 'evt-2' }]);
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await post(payload, 'not-a-real-signature', ts);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('INVALID_SIGNATURE');
  });

  it('rejects a tampered payload (signature no longer matches)', async () => {
    const signed = JSON.stringify([{ event: 'bounce', sg_event_id: 'evt-3' }]);
    const tampered = JSON.stringify([{ event: 'delivered', sg_event_id: 'evt-3' }]);
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await post(tampered, sign(signed, ts), ts);
    expect(res.statusCode).toBe(403);
  });

  it('rejects when signature/timestamp headers are missing (403)', async () => {
    const res = await request(app)
      .post('/webhooks/sendgrid')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify([{ event: 'bounce' }]));
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('MISSING_SIGNATURE');
  });

  it('returns 503 when the verification key is not configured', async () => {
    delete process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
    const payload = JSON.stringify([{ event: 'bounce', sg_event_id: 'evt-4' }]);
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await post(payload, sign(payload, ts), ts);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe('WEBHOOK_NOT_CONFIGURED');
  });

  it('is idempotent — a replayed sg_event_id is accepted without error', async () => {
    const payload = JSON.stringify([
      { event: 'spamreport', email: 'c@d.com', sg_event_id: 'evt-dup' },
    ]);
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = sign(payload, ts);
    const first = await post(payload, sig, ts);
    const second = await post(payload, sig, ts);
    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);
  });
});
