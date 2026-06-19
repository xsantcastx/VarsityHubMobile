import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';

import { captureException, captureMessage } from '../lib/sentry.js';

/**
 * SendGrid Signed Event Webhook.
 *
 * Gives the team visibility into deliverability problems (hard bounces, spam
 * complaints, drops, blocks) that are otherwise invisible — the live send path
 * is fire-and-forget and SendGrid handles its own suppression list silently.
 *
 * Security (per audit standard — webhooks must be signature-verified + idempotent):
 * - ECDSA (P-256) signature verified against SENDGRID_WEBHOOK_VERIFICATION_KEY
 *   over `timestamp + rawBody`. Mounted with a raw body parser in app.ts so the
 *   bytes are verified exactly as SendGrid signed them.
 * - Idempotent: SendGrid retries duplicate `sg_event_id`s; an in-memory TTL
 *   guard makes reprocessing a no-op.
 *
 * Note: this is visibility/alerting only. A persistent local suppression list
 * would be a separate change (it requires a DB migration) and is largely
 * redundant — SendGrid already drops sends to addresses on its own list.
 */

const SIGNATURE_HEADER = 'x-twilio-email-event-webhook-signature';
const TIMESTAMP_HEADER = 'x-twilio-email-event-webhook-timestamp';

// Deliverability events worth surfacing. `delivered`/`open`/`click` etc. are ignored.
const ALERT_EVENTS = new Set(['bounce', 'dropped', 'spamreport', 'blocked']);

// In-memory idempotency guard. SendGrid retries deliver duplicate sg_event_ids;
// reprocessing within the window is a no-op. Survives a single process only —
// acceptable because the handler effect is logging/alerting, not state.
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1h
const MAX_DEDUP_ENTRIES = 50_000;
const seenEventIds = new Map<string, number>();

function alreadyProcessed(eventId: string): boolean {
  const now = Date.now();
  if (seenEventIds.size > MAX_DEDUP_ENTRIES) {
    for (const [key, ts] of seenEventIds) {
      if (now - ts > DEDUP_WINDOW_MS) seenEventIds.delete(key);
    }
  }
  const prev = seenEventIds.get(eventId);
  if (prev !== undefined && now - prev < DEDUP_WINDOW_MS) return true;
  seenEventIds.set(eventId, now);
  return false;
}

/** Verify SendGrid's ECDSA signature over `timestamp + payload`. */
function verifySignature(
  verificationKeyBase64Der: string,
  payload: string,
  signatureBase64: string,
  timestamp: string
): boolean {
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(verificationKeyBase64Der, 'base64'),
    format: 'der',
    type: 'spki',
  });
  const verifier = crypto.createVerify('sha256');
  verifier.update(timestamp + payload);
  verifier.end();
  return verifier.verify(publicKey, Buffer.from(signatureBase64, 'base64'));
}

export const sendgridWebhookRouter = Router();

sendgridWebhookRouter.post('/', (req: Request, res: Response) => {
  const verificationKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  if (!verificationKey) {
    // Misconfiguration, not a forged request. 503 so SendGrid retries once the
    // key is set, rather than silently dropping deliverability events.
    captureMessage(
      '[sendgrid-webhook] SENDGRID_WEBHOOK_VERIFICATION_KEY not configured — cannot verify events',
      'error',
      { context: 'sendgrid_webhook' }
    );
    return res.status(503).json({ error: 'WEBHOOK_NOT_CONFIGURED' });
  }

  const signature = req.header(SIGNATURE_HEADER);
  const timestamp = req.header(TIMESTAMP_HEADER);
  if (!signature || !timestamp) {
    return res.status(403).json({ error: 'MISSING_SIGNATURE' });
  }

  const rawBody = req.body as unknown;
  const payload = Buffer.isBuffer(rawBody)
    ? rawBody.toString('utf8')
    : typeof rawBody === 'string'
      ? rawBody
      : JSON.stringify(rawBody ?? '');

  let verified = false;
  try {
    verified = verifySignature(verificationKey, payload, signature, timestamp);
  } catch (err) {
    // A malformed key/signature is treated as a verification failure, not a 500.
    captureException(err instanceof Error ? err : new Error(String(err)), {
      context: 'sendgrid_webhook_verify',
    });
    verified = false;
  }
  if (!verified) {
    return res.status(403).json({ error: 'INVALID_SIGNATURE' });
  }

  let events: unknown;
  try {
    events = JSON.parse(payload);
  } catch (err) {
    // Signature was valid but the body isn't JSON — accept it (returning 2xx so
    // SendGrid doesn't retry a permanently-bad payload) and record the anomaly.
    captureException(err instanceof Error ? err : new Error(String(err)), {
      context: 'sendgrid_webhook_parse',
    });
    return res.status(204).end();
  }

  if (!Array.isArray(events)) {
    return res.status(204).end();
  }

  for (const ev of events as Array<Record<string, any>>) {
    const eventId = String(ev?.sg_event_id ?? '');
    if (eventId && alreadyProcessed(eventId)) continue;

    const type = String(ev?.event ?? '').toLowerCase();
    if (!ALERT_EVENTS.has(type)) continue;

    const detail = {
      context: 'sendgrid_webhook',
      event: type,
      email: ev?.email,
      reason: ev?.reason,
      status: ev?.status,
      sg_event_id: eventId,
      sg_message_id: ev?.sg_message_id,
    };

    if (type === 'spamreport') {
      console.warn('[sendgrid-webhook] spam complaint', detail);
      captureMessage(`[sendgrid-webhook] spam complaint from ${ev?.email}`, 'warning', detail);
    } else {
      console.error(`[sendgrid-webhook] ${type}`, detail);
      captureMessage(`[sendgrid-webhook] ${type} for ${ev?.email}`, 'warning', detail);
    }
  }

  return res.status(204).end();
});
