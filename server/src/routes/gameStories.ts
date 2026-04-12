import type { Request, Response } from 'express';
import { z } from 'zod';
import { validateContent } from '../lib/contentFilter.js';
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
  expires_at: story.expires_at instanceof Date ? story.expires_at.toISOString() : (story.expires_at ?? null),
});

const isMissingStoryLocationColumnError = (error: any): boolean => {
  if (!error || error.code !== 'P2022') return false;
  const modelName = String(error?.meta?.modelName ?? '');
  const column = String(error?.meta?.column ?? '');
  return modelName === 'Story' && (column === 'Story.lat' || column === 'Story.lng');
};

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

const STORY_EXPIRY_HOURS = 24;

export const makeListMediaHandler = ({ prisma }: StoryDeps) => async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const now = new Date();
  try {
    const items = await prisma.story.findMany({
      where: {
        game_id: id,
        OR: [
          { expires_at: { gt: now } },
          { expires_at: null }, // Backward compat: stories without expires_at still show
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true,
        media_url: true,
        created_at: true,
        caption: true,
        user_id: true,
        expires_at: true,
      },
    });
    // If include_expired=1 and user is authenticated, append creator's expired stories
    const includeExpired = String((req as any).query?.include_expired ?? '') === '1';
    const currentUserId = (req as AuthedRequest).user?.id ?? null;
    if (includeExpired && currentUserId) {
      const expired = await prisma.story.findMany({
        where: {
          game_id: id,
          user_id: currentUserId,
          expires_at: { lte: now },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
        select: {
          id: true,
          media_url: true,
          created_at: true,
          caption: true,
          user_id: true,
          expires_at: true,
        },
      });
      const seen = new Set(items.map((s) => s.id));
      for (const s of expired) {
        if (!seen.has(s.id)) {
          items.push(s);
          seen.add(s.id);
        }
      }
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return res.json(items.map(serializeMedia));
  } catch (error: any) {
    if (isMissingStoryLocationColumnError(error)) {
      console.warn('[stories] Story location columns missing, falling back to legacy query');
      try {
        const items = await prisma.$queryRaw<Array<{
          id: string;
          media_url: string;
          created_at: Date | string;
          caption: string | null;
          user_id: string | null;
        }>>`
          SELECT "id", "media_url", "created_at", "caption", "user_id"
          FROM "Story"
          WHERE "game_id" = ${id}
            AND ("expires_at" IS NULL OR "expires_at" > NOW())
          ORDER BY "created_at" DESC
          LIMIT 50
        `;
        return res.json(items.map(serializeMedia));
      } catch (fallbackError) {
        console.error('[stories] Legacy fallback query failed:', fallbackError);
        return res.status(500).json({ error: 'Failed to load game media' });
      }
    }

    console.error('[stories] Failed to list game media:', error);
    return res.status(500).json({ error: 'Failed to load game media' });
  }
};

export const makeCreateStoryHandler = ({ prisma }: StoryDeps) => async (req: AuthedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const parsed = storySchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  // Sample games are onboarding placeholders with synthetic IDs (`sample-…`).
  // They are not real Game rows, so Story's game_id foreign key cannot point
  // at them — previously the insert here raised an FK violation that
  // surfaced as an opaque 500. Reject explicitly so the client can show a
  // useful message and the smoke suite can lock the behaviour.
  const isSampleGame = /^sample-/i.test(id);
  if (isSampleGame) {
    return res.status(400).json({
      error: 'SAMPLE_GAME_STORY_UNSUPPORTED',
      code: 'SAMPLE_GAME_STORY_UNSUPPORTED',
      message: 'Stories cannot be posted to sample games. Join or create a real game first.',
    });
  }

  {
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

  if (parsed.data.caption && parsed.data.caption.trim().length > 0) {
    const filterResult = validateContent({ content: parsed.data.caption });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }
  }
  
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + STORY_EXPIRY_HOURS * 60 * 60 * 1000);
  const createData: any = {
    game_id: id,
    user_id: req.user.id,
    media_url: parsed.data.media_url,
    caption: parsed.data.caption,
    expires_at: expiresAt,
  };
  if (typeof lat === 'number') createData.lat = lat;
  if (typeof lng === 'number') createData.lng = lng;

  let story;
  try {
    story = await prisma.story.create({ data: createData });
  } catch (error: any) {
    if (!isMissingStoryLocationColumnError(error)) {
      console.error('[stories] Failed to create story:', error);
      return res.status(500).json({ error: 'Failed to create story' });
    }
    console.warn('[stories] Story location columns missing, retrying without lat/lng');
    const { lat: _lat, lng: _lng, ...withoutCoords } = createData;
    try {
      story = await prisma.story.create({ data: withoutCoords });
    } catch (fallbackError) {
      console.error('[stories] Failed to create story in fallback mode:', fallbackError);
      return res.status(500).json({ error: 'Failed to create story' });
    }
  }

  return res.status(201).json(story);
};
