import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const categoriesRouter = Router();

const mapCategory = (category: { id: string; name: string; slug: string; icon_url: string | null }) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  icon_url: category.icon_url,
});

categoriesRouter.get('/', requireAuth as any, async (req: AuthedRequest, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
  const followingRaw = typeof req.query.following === 'string' ? req.query.following : '';
  const followingOnly = followingRaw === '1' || followingRaw.toLowerCase() === 'true';

  const select = { id: true, name: true, slug: true, icon_url: true } as const;
  let categories;

  if (followingOnly) {
    categories = await prisma.category.findMany({
      where: { followers: { some: { user_id: req.user!.id } } },
      orderBy: [{ name: 'asc' }],
      take: limit,
      select,
    });
  } else {
    categories = await prisma.category.findMany({
      orderBy: [
        { followers: { _count: 'desc' } },
        { created_at: 'desc' },
      ],
      take: limit,
      select,
    });
  }

  res.json(categories.map(mapCategory));
});
