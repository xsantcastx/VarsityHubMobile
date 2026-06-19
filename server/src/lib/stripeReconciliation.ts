/**
 * Stripe webhook reconciliation probe.
 *
 * Catches the failure mode where Stripe accepts a payment, sends our server
 * a webhook, but the webhook delivery fails (network blip, server bouncing,
 * 5xx response). The payment succeeds in Stripe; our DB never finalizes;
 * the user's ad never goes live; the operator has no signal.
 *
 * This probe runs on a schedule (every 30 min via the BullMQ scheduler),
 * queries Stripe for recently-paid checkout sessions, and surfaces any that
 * lack a corresponding TransactionLog row to Sentry. It does NOT auto-
 * finalize — auto-recovery has subtle race conditions with refunds,
 * partial finalization, and idempotency that we don't want to handle in a
 * cron without manual oversight. Operator gets a Sentry alert, runs the
 * existing recovery flow.
 *
 * Sentry context tag: `stripe_reconciliation_orphan`
 *   payload: session_id, amount_cents, customer_email, created_at,
 *            ad_id_hint (from session.metadata), session_url
 */

import Stripe from 'stripe';
import { prisma } from './prisma.js';
import { captureException, captureMessage } from './sentry.js';

const RECONCILE_LOOKBACK_HOURS = 4;
const SESSION_FETCH_LIMIT = 100;

export type StripeReconciliationResult = {
  scanned: number;
  orphans: number;
  ignored: number;
  durationMs: number;
  truncated: boolean;
};

export async function reconcileStripeWebhookOrphans(): Promise<StripeReconciliationResult> {
  const startedAt = Date.now();

  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('[stripe-reconcile] STRIPE_SECRET_KEY not set — skipping reconciliation');
    return { scanned: 0, orphans: 0, ignored: 0, durationMs: 0, truncated: false };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    timeout: 20000,
    maxNetworkRetries: 2,
  });
  const cutoffSec = Math.floor(Date.now() / 1000) - RECONCILE_LOOKBACK_HOURS * 60 * 60;

  // Stripe paginates with 100/page max. For an MVP we read the first page
  // and surface a `truncated` flag if we hit the limit so the operator
  // knows to extend the window or increase frequency.
  const list = await stripe.checkout.sessions.list({
    created: { gte: cutoffSec },
    limit: SESSION_FETCH_LIMIT,
  });

  let orphans = 0;
  let ignored = 0;

  for (const session of list.data) {
    // Only paid + complete sessions need reconciliation. Open sessions are
    // expected to lack a transaction log (user hasn't paid yet); expired
    // sessions correctly have no log; failed payments are tracked separately.
    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      ignored++;
      continue;
    }

    const existing = await prisma.transactionLog.findUnique({
      where: { stripe_session_id: session.id },
      select: { id: true, status: true },
    });

    if (existing) {
      // Session was finalized (either by webhook or a prior reconciliation
      // run). No action needed.
      continue;
    }

    // Real orphan. Capture to Sentry with the metadata an operator needs
    // to manually recover.
    orphans++;
    captureMessage('Stripe session paid but no transaction log entry', 'error', {
      context: 'stripe_reconciliation_orphan',
      stripe_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
      amount_total_cents: session.amount_total ?? null,
      currency: session.currency ?? null,
      customer_email: session.customer_details?.email ?? session.customer_email ?? null,
      created_unix: session.created,
      session_metadata: session.metadata ?? {},
      session_url: session.url ?? null,
    });
    console.error(
      `[stripe-reconcile] ORPHAN session ${session.id}: paid ${session.amount_total ?? '?'} ${session.currency ?? '?'} but no TransactionLog row`
    );
  }

  const durationMs = Date.now() - startedAt;
  const truncated = list.has_more === true;
  console.log(
    `[stripe-reconcile] scanned=${list.data.length} orphans=${orphans} ignored=${ignored} duration_ms=${durationMs}${truncated ? ' truncated=true' : ''}`
  );

  if (truncated) {
    captureMessage(
      `Stripe reconciliation truncated at ${SESSION_FETCH_LIMIT} sessions in ${RECONCILE_LOOKBACK_HOURS}h window`,
      'warning',
      {
        context: 'stripe_reconciliation_truncated',
        scanned: list.data.length,
        lookback_hours: RECONCILE_LOOKBACK_HOURS,
      }
    );
  }

  return { scanned: list.data.length, orphans, ignored, durationMs, truncated };
}
