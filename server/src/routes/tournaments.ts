import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

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
tournamentsRouter.post('/', requireAuth as any, async (req: AuthedRequest, res: Response) => {
  try {
    const {
      name,
      description,
      sport,
      season,
      logo_url,
      location,
      stadium_name,
      capacity,
      opened_year,
      tournament_start_date,
      tournament_end_date,
      tournament_format,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const tournament = await prisma.organization.create({
      data: {
        name,
        description: description || `${season ? `${season} ` : ''}${sport ?? ''} Tournament`.trim() || undefined,
        type: 'tournament',
        is_tournament: true,
        sport,
        logo_url,
        location,
        stadium_name,
        capacity: toOptionalNumber(capacity),
        opened_year: toOptionalNumber(opened_year),
        tournament_start_date: tournament_start_date ? new Date(tournament_start_date) : undefined,
        tournament_end_date: tournament_end_date ? new Date(tournament_end_date) : undefined,
        tournament_format: tournament_format || 'GROUP_STAGE',
        created_by: req.user?.id,
      },
    });

    return res.status(201).json(tournament);
  } catch (error: any) {
    console.error('Failed to create tournament:', error);
    return res.status(500).json({ error: error.message || 'Failed to create tournament' });
  }
});

/**
 * GET /tournaments
 * List all tournaments
 */
tournamentsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const tournaments = await prisma.organization.findMany({
      where: { type: 'tournament' },
      include: {
        teams: {
          select: {
            id: true,
            name: true,
            logo_url: true,
          },
        },
        games: {
          select: {
            id: true,
            date: true,
            home_team: true,
            away_team: true,
            location: true,
            group: true,
            round: true,
            stadium: true,
            stadium_capacity: true,
            banner_image_url: true,
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    return res.json(tournaments);
  } catch (error: any) {
    console.error('Failed to fetch tournaments:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch tournaments' });
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
        games: {
          select: {
            id: true,
            date: true,
            home_team: true,
            away_team: true,
            location: true,
            group: true,
            round: true,
            stadium: true,
            stadium_capacity: true,
            banner_image_url: true,
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    return res.json(tournament);
  } catch (error: any) {
    console.error('Failed to fetch tournament:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch tournament' });
  }
});

/**
 * PATCH /tournaments/:id
 * Update tournament
 */
tournamentsRouter.patch('/:id', requireAuth as any, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      logo_url,
      location,
      stadium_name,
      capacity,
      opened_year,
      tournament_start_date,
      tournament_end_date,
      tournament_format,
      tournament_location,
      tournament_rules,
      tournament_logo_url,
    } = req.body;

    const data: Record<string, unknown> = {};
    if (typeof name === 'string') data.name = name;
    if (typeof description === 'string') data.description = description;
    if (typeof logo_url === 'string') data.logo_url = logo_url;
    if (typeof location === 'string') data.location = location;
    if (typeof stadium_name === 'string') data.stadium_name = stadium_name;
    if (capacity !== undefined) data.capacity = toOptionalNumber(capacity) ?? null;
    if (opened_year !== undefined) data.opened_year = toOptionalNumber(opened_year) ?? null;
    if (tournament_start_date) data.tournament_start_date = new Date(tournament_start_date);
    if (tournament_end_date) data.tournament_end_date = new Date(tournament_end_date);
    if (typeof tournament_format === 'string') data.tournament_format = tournament_format;
    if (typeof tournament_location === 'string') data.tournament_location = tournament_location;
    if (typeof tournament_rules === 'string') data.tournament_rules = tournament_rules;
    if (typeof tournament_logo_url === 'string') data.tournament_logo_url = tournament_logo_url;

    const tournament = await prisma.organization.update({
      where: { id },
      data,
    });

    return res.json(tournament);
  } catch (error: any) {
    console.error('Failed to update tournament:', error);
    return res.status(500).json({ error: error.message || 'Failed to update tournament' });
  }
});

/**
 * POST /tournaments/:id/teams
 * Add team to tournament
 */
tournamentsRouter.post('/:id/teams', requireAuth as any, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { team_id } = req.body;

    if (!team_id) {
      return res.status(400).json({ error: 'team_id is required' });
    }

    const team = await prisma.team.update({
      where: { id: team_id },
      data: { organization_id: id },
    });

    return res.json(team);
  } catch (error: any) {
    console.error('Failed to add team to tournament:', error);
    return res.status(500).json({ error: error.message || 'Failed to add team' });
  }
});

/**
 * POST /tournaments/:id/games
 * Create a tournament game/match
 */
tournamentsRouter.post('/:id/games', requireAuth as any, async (req: AuthedRequest, res: Response) => {
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
      group,
      round,
      stadium,
      stadium_capacity,
      banner_image_url,
    } = req.body;

    if (!home_team || !away_team || !date) {
      return res.status(400).json({ error: 'home_team, away_team, and date are required' });
    }

    const tournament = await prisma.organization.findUnique({ where: { id } });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const game = await prisma.game.create({
      data: {
        title: title || `${home_team} vs ${away_team}`,
        home_team,
        away_team,
        date: new Date(date),
        location: location || stadium || tournament.tournament_location,
        latitude: toOptionalNumber(latitude),
        longitude: toOptionalNumber(longitude),
        group,
        round,
        stadium,
        stadium_capacity: toOptionalNumber(stadium_capacity),
        banner_image_url,
        tournament_organization_id: id,
        approval_status: 'approved',
      },
    });

    return res.status(201).json(game);
  } catch (error: any) {
    console.error('Failed to create tournament game:', error);
    return res.status(500).json({ error: error.message || 'Failed to create game' });
  }
});
