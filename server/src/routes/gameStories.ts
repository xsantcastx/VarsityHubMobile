import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import type { PrismaClient } from '@prisma/client';
import { verifyStoryPostingPermission } from '../lib/geofencing.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';

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

type StoryDeps = { prisma: PrismaClient };

export const makeListMediaHandler = ({ prisma }: StoryDeps) => async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const items = await prisma.story.findMany({
    where: { game_id: id },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  res.json(items.map(serializeMedia));
};

export const makeCreateStoryHandler = ({ prisma }: StoryDeps) => async (req: AuthedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const parsed = storySchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  
  // Skip geofencing for sample games (IDs starting with "sample-")
  const isSampleGame = /^sample-/i.test(id);
  
  if (!isSampleGame) {
    // Fetch game with team IDs so we can check team membership for bypass
    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        home_team_id: true,
        away_team_id: true,
        events: {
          orderBy: { date: 'asc' },
          take: 1,
          select: { id: true, date: true, latitude: true, longitude: true, location: true },
        },
      },
    });

    // Admins and active members of either team bypass geofencing/time-window checks
    const isAdmin = await getIsAdmin(req as any);
    const teamIds = [game?.home_team_id, game?.away_team_id].filter(Boolean) as string[];
    const isTeamMember = teamIds.length > 0
      ? !!(await prisma.teamMembership.findFirst({
          where: { user_id: req.user.id, team_id: { in: teamIds }, status: 'active' },
          select: { id: true },
        }))
      : false;

    if (!isAdmin && !isTeamMember && game?.events && game.events.length > 0) {
      const event = game.events[0];
      const location = parsed.data.location;
      const lat = location?.lat ?? null;
      const lng = location?.lng ?? null;

      const verification = await verifyStoryPostingPermission(
        event.id,
        req.user.id,
        lat,
        lng
      );

      if (!verification.allowed) {
        return res.status(403).json({
          error: verification.code || 'LOCATION_VERIFICATION_FAILED',
          message: verification.reason,
          distance: verification.distance,
        });
      }
    }
  }
  
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
