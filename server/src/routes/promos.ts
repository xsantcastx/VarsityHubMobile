import { Router } from 'express';
import { previewPromo, redeemPromo } from '../lib/promos.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const promosRouter = Router();

promosRouter.post('/preview', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const { code, subtotal_cents, service } = (req.body as any) || {};
  const result = await previewPromo({
    code: String(code || ''),
    subtotalCents: Number(subtotal_cents || 0),
    service: service ? String(service) : undefined,
    userId: req.user.id,
  });
  return res.json(result);
});

promosRouter.post('/redeem', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const { code, subtotal_cents, service, order_id } = (req.body as any) || {};
  const result = await redeemPromo({
    code: String(code || ''),
    subtotalCents: Number(subtotal_cents || 0),
    service: service ? String(service) : undefined,
    userId: req.user.id,
    orderId: order_id ? String(order_id) : undefined,
  });
  if (!('ok' in result) || !result.ok) return res.status(400).json(result);
  return res.json(result);
});
