import { Router } from 'express';
import { z } from 'zod';
import { previewPromo, redeemPromo } from '../lib/promos.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

const previewSchema = z.object({
  code: z.string().max(50),
  subtotal_cents: z.coerce.number().int().min(0),
  service: z.string().max(50).optional(),
});
const redeemSchema = z.object({
  code: z.string().max(50),
  subtotal_cents: z.coerce.number().int().min(0),
  service: z.string().max(50).optional(),
  order_id: z.string().max(100).optional(),
});

export const promosRouter = Router();

promosRouter.post('/preview', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const parsed = previewSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { code, subtotal_cents, service } = parsed.data;
    const result = await previewPromo({
      code: String(code || ''),
      subtotalCents: Number(subtotal_cents || 0),
      service: service ? String(service) : undefined,
      userId: req.user.id,
    });
    return res.json(result);
  } catch (err) {
    console.error('[promos] POST /preview error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

promosRouter.post('/redeem', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const parsed = redeemSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { code, subtotal_cents, service, order_id } = parsed.data;
    const result = await redeemPromo({
      code: String(code || ''),
      subtotalCents: Number(subtotal_cents || 0),
      service: service ? String(service) : undefined,
      userId: req.user.id,
      orderId: order_id ? String(order_id) : undefined,
    });
    if (!('ok' in result) || !result.ok) return res.status(400).json(result);
    return res.json(result);
  } catch (err) {
    console.error('[promos] POST /redeem error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
