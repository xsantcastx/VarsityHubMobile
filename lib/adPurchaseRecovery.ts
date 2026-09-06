import { z } from 'zod';
import { uuid } from 'expo-modules-core';
import { httpGet, httpPost } from '@/api/http';

const intentSchema = z.object({
  id: z.string().uuid(),
  ad_id: z.string().min(1),
  status: z.enum(['pending', 'needs_action', 'completed']),
  dates: z.array(z.string()),
  last_error_code: z.string().nullable(),
  items: z
    .array(
      z.object({
        sku: z.enum(['MOND_THURS', 'FRI_SUN']),
        quantity: z.number().int().min(1).max(9),
        remaining: z.number().int().min(0).max(9),
      })
    )
    .min(1),
});
export type AdPurchaseIntent = z.infer<typeof intentSchema>;
export async function createAdIntent(adId: string, dates: string[]) {
  return intentSchema.parse(
    await httpPost('/payments/apple/ad-intents', {
      ad_id: adId,
      dates,
      client_transaction_id: uuid.v4(),
    })
  );
}
export async function saveAdReceipt(intentId: string, jws: string) {
  return intentSchema.parse(
    await httpPost(`/payments/apple/ad-intents/${intentId}/receipts`, { jws })
  );
}
export function reconcileAdIntents() {
  return httpPost('/payments/apple/ad-intents/reconcile', {});
}

/** StoreKit may only forget a consumable after the authenticated server has accepted it. */
export async function recoverAdReceipt(
  purchase: { appAccountToken?: string | null; purchaseToken?: string | null },
  isCurrentAccount: () => boolean,
  finish: () => Promise<unknown>,
  save = saveAdReceipt
) {
  if (!isCurrentAccount()) throw new Error('Purchase account changed');
  const id = z.string().uuid().parse(purchase.appAccountToken);
  const jws = z.string().min(1).parse(purchase.purchaseToken);
  const intent = await save(id, jws);
  if (!isCurrentAccount()) throw new Error('Purchase account changed');
  await finish();
  return intent;
}

export async function listAdIntents() {
  return z
    .object({ items: z.array(intentSchema) })
    .parse(await httpGet('/payments/apple/ad-intents')).items;
}
