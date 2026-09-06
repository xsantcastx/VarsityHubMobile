/** Read-only reconciliation preview. Never charges, refunds, or modifies inventory. */
import { prisma } from '../src/lib/prisma.js';
import { isRefundedAdPurchase } from '../src/lib/adInventory.js';

const limit = Number(process.env.AD_PROVENANCE_AUDIT_LIMIT || 1000);
if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
  throw new Error('Limit must be 1–10000');
try {
  const purchases = await prisma.transactionLog.findMany({
    where: { transaction_type: 'AD_PURCHASE', status: 'COMPLETED' },
    orderBy: { id: 'asc' },
    take: limit + 1,
    select: {
      id: true,
      order_id: true,
      status: true,
      metadata: true,
      stripe_session_id: true,
      stripe_payment_intent_id: true,
    },
  });
  const complete = purchases.length <= limit;
  const dates = new Map<string, string[]>();
  const missingReferences: Array<{ transactionId: string; proposedPaymentIntentId: string }> = [];
  const unclassified: string[] = [];
  for (const purchase of purchases.slice(0, limit)) {
    if (isRefundedAdPurchase(purchase)) continue;
    if (!purchase.stripe_payment_intent_id && purchase.stripe_session_id?.startsWith('pi_')) {
      missingReferences.push({
        transactionId: purchase.id,
        proposedPaymentIntentId: purchase.stripe_session_id,
      });
    }
    const metadata = purchase.metadata as { dates?: unknown } | null;
    if (
      !purchase.order_id ||
      !Array.isArray(metadata?.dates) ||
      !metadata.dates.every(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
    ) {
      unclassified.push(purchase.id);
      continue;
    }
    for (const date of new Set(metadata.dates as string[])) {
      const key = `${purchase.order_id}/${date}`;
      dates.set(key, [...(dates.get(key) || []), purchase.id]);
    }
  }
  console.log(
    JSON.stringify(
      {
        mode: 'read-only-preview',
        checkedAt: new Date().toISOString(),
        complete,
        scanned: Math.min(purchases.length, limit),
        missingReferences,
        overlappingPaidPurchases: [...dates.entries()]
          .filter(([, ids]) => ids.length > 1)
          .map(([adDate, transactionIds]) => ({ adDate, transactionIds })),
        unclassified,
        nextStep:
          'Review against provider receipts before any historical repair. Missing references are exact legacy PI-field candidates; never infer date ownership for unclassified purchases.',
      },
      null,
      2
    )
  );
  if (!complete) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
