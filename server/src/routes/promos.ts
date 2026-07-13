import { Router } from 'express';
import { z } from 'zod';
import { previewPromo, redeemPromo } from '../lib/promos.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { apiError } from '../lib/apiResponse.js';
import { promoCodeLimiter } from '../middleware/rateLimiters.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

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

promosRouter.post(
  '/preview',
  requireAuth as any,
  promoCodeLimiter as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      if (!req.user) return apiError(res, 401, 'Unauthorized');
      const parsed = previewSchema.safeParse(req.body || {});
      if (!parsed.success)
        return apiError(res, 400, 'Invalid payload', 'VALIDATION_ERROR', parsed.error.issues);
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
      return apiError(res, 500, 'Internal server error', 'INTERNAL_ERROR');
    }
  })
);

promosRouter.post(
  '/redeem',
  requireAuth as any,
  promoCodeLimiter as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      if (!req.user) return apiError(res, 401, 'Unauthorized');
      const parsed = redeemSchema.safeParse(req.body || {});
      if (!parsed.success)
        return apiError(res, 400, 'Invalid payload', 'VALIDATION_ERROR', parsed.error.issues);
      const { code, subtotal_cents, service, order_id } = parsed.data;
      const result = await redeemPromo({
        code: String(code || ''),
        subtotalCents: Number(subtotal_cents || 0),
        service: service ? String(service) : undefined,
        userId: req.user.id,
        orderId: order_id ? String(order_id) : undefined,
      });
      if (!('ok' in result) || !result.ok)
        return apiError(res, 400, 'Promo code validation failed', 'PROMO_INVALID', result);
      return res.json(result);
    } catch (err) {
      console.error('[promos] POST /redeem error:', err);
      return apiError(res, 500, 'Internal server error', 'INTERNAL_ERROR');
    }
  })
);
