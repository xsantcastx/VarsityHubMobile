import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';

const createTournamentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  sport: z.string().max(100).optional(),
  season: z.string().max(50).optional(),
  logo_url: z.string().url().max(2048).optional(),
  location: z.string().max(500).optional(),
  stadium_name: z.string().max(200).optional(),
  capacity: z.number().int().min(0).optional(),
  opened_year: z.number().int().min(1800).max(2100).optional(),
  tournament_start_date: z.string().optional(),
  tournament_end_date: z.string().optional(),
  tournament_format: z.string().max(100).optional(),
});

export const tournamentsRouter = Router();

const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

/**
 * POST /tournaments
 * Create a new tournament organization
 */
tournamentsRouter.post('/', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res: Response) => {
  try {
    const parsed = createTournamentSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { name, description, sport, season, logo_url, location, stadium_name, capacity, opened_year, tournament_start_date, tournament_end_date, tournament_format } = parsed.data;

    const tournament = await prisma.organization.create({
      data: {
        name,
        description: description ?? `${season ? `${season} ` : ''}${sport ?? ''} Tournament`.trim() || undefined,
        org_type: 'tournament',
        sport: sport ?? undefined,
        location: location ?? undefined,
        updated_at: new Date(),
      },
    });

    return res.status(201).json(tournament);
  } catch (error: any) {
    console.error('Failed to create tournament:', error);
    return res.status(500).json({ error: 'Failed to create tournament' });
  }
});

/**
 * GET /tournaments
 * List all tournaments
 */
tournamentsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const tournaments = await prisma.organization.findMany({
      where: { org_type: 'tournament' },
      include: {
        teams: {
          select: {
            id: true,
            name: true,
            logo_url: true,
          },
        },
      },
    });

    return res.json(tournaments);
  } catch (error: any) {
    console.error('Failed to fetch tournaments:', error);
    return res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

/**
 * GET /tournaments/:id
 * Get tournament details
 */
tournamentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.organization.findUnique({
      where: { id },
      include: {
        teams: {
          select: {
            id: true,
            name: true,
            logo_url: true,
            description: true,
            sport: true,
            season_start: true,
            season_end: true,
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    return res.json(tournament);
  } catch (error: any) {
    console.error('Failed to fetch tournament:', error);
    return res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

/**
 * PATCH /tournaments/:id
 * Update tournament
 */
tournamentsRouter.patch('/:id', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const membership = await prisma.organizationMembership.findUnique({
      where: { organization_id_user_id: { organization_id: id, user_id: req.user!.id } },
    });
    if (!membership || !['owner', 'manager'].includes(membership.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const {
      name,
      description,
      logo_url,
      location,
      stadium_name,
      capacity,
      opened_year,
    } = req.body;

    const data: Record<string, unknown> = {};
    if (typeof name === 'string') data.name = name;
    if (typeof description === 'string') data.description = description;
    if (typeof location === 'string') data.location = location;

    const tournament = await prisma.organization.update({
      where: { id },
      data,
    });

    return res.json(tournament);
  } catch (error: any) {
    console.error('Failed to update tournament:', error);
    return res.status(500).json({ error: 'Failed to update tournament' });
  }
});

/**
 * POST /tournaments/:id/teams
 * Add team to tournament
 */
tournamentsRouter.post('/:id/teams', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { team_id } = req.body;

    if (!team_id) {
      return res.status(400).json({ error: 'team_id is required' });
    }

    const membership = await prisma.organizationMembership.findUnique({
      where: { organization_id_user_id: { organization_id: id, user_id: req.user!.id } },
    });
    if (!membership || !['owner', 'manager'].includes(membership.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const team = await prisma.team.update({
      where: { id: team_id },
      data: { organization_id: id },
    });

    return res.json(team);
  } catch (error: any) {
    console.error('Failed to add team to tournament:', error);
    return res.status(500).json({ error: 'Failed to add team' });
  }
});

/**
 * POST /tournaments/:id/games
 * Create a tournament game/match
 */
tournamentsRouter.post('/:id/games', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      home_team,
      away_team,
      date,
      location,
      latitude,
      longitude,
    } = req.body;

    if (!home_team || !away_team || !date) {
      return res.status(400).json({ error: 'home_team, away_team, and date are required' });
    }

    const tournament = await prisma.organization.findUnique({ where: { id } });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const membership = await prisma.organizationMembership.findUnique({
      where: { organization_id_user_id: { organization_id: id, user_id: req.user!.id } },
    });
    if (!membership || !['owner', 'manager'].includes(membership.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const game = await prisma.game.create({
      data: {
        title: title || `${home_team} vs ${away_team}`,
        home_team,
        away_team,
        date: new Date(date),
        location: location || tournament.location || null,
        latitude: toOptionalNumber(latitude),
        longitude: toOptionalNumber(longitude),
        approval_status: 'approved',
      },
    });

    return res.status(201).json(game);
  } catch (error: any) {
    console.error('Failed to create tournament game:', error);
    return res.status(500).json({ error: 'Failed to create game' });
  }
});
