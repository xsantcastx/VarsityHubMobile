import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import type { PrismaClient } from '@prisma/client';

export const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  const sanitized = url.split('?')[0].toLowerCase();
  return ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'].some((ext) => sanitized.endsWith(ext));
};

export const serializeMedia = (story: any) => ({
  id: story.id,
  url: story.media_url,
  kind: isVideoUrl(story.media_url) ? 'video' : 'photo',
  created_at: story.created_at instanceof Date ? story.created_at.toISOString() : story.created_at,
  caption: story.caption ?? null,
  user_id: story.user_id ?? null,
});

const locationSchema = z.object({
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  source: z.enum(['device','places','zip','derived']).nullable().optional(),
}).optional();

const storySchema = z.object({
  media_url: z.string().min(1),
  caption: z.string().optional(),
  location: locationSchema,
});

type StoryDeps = { prisma: Pick<PrismaClient, 'story'> };

export const makeListMediaHandler = ({ prisma }: StoryDeps) => async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const items = await prisma.story.findMany({
    where: { game_id: id },
    orderBy: { created_at: 'desc' },
  });
  res.json(items.map(serializeMedia));
};

export const makeCreateStoryHandler = ({ prisma }: StoryDeps) => async (req: AuthedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const parsed = storySchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  
  // Extract location data if provided
  const location = parsed.data.location;
  const lat = location?.lat ?? null;
  const lng = location?.lng ?? null;
  
  const story = await prisma.story.create({
    data: {
      game_id: id,
      user_id: req.user.id,
      media_url: parsed.data.media_url,
      caption: parsed.data.caption,
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
    },
  });
  return res.status(201).json(story);
};
