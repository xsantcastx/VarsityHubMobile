import { prisma } from '@/lib/prisma';
import { AuthRequest, requireAuth } from '@/middleware/auth';
import express, { Request, Response } from 'express';

const router = express.Router();

/**
 * POST /tournaments
 * Create a new tournament organization
 */
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, sport, season, logo_url, location, stadium_name, capacity, opened_year } = req.body;

    if (!name || !sport) {
      return res.status(400).json({ error: 'name and sport are required' });
    }

    const tournament = await prisma.organization.create({
      data: {
        name,
        description: description || `${season || ''} ${sport} Tournament`,
        type: 'tournament',
        logo_url,
        location,
        stadium_name,
        capacity: capacity ? parseInt(capacity) : undefined,
        opened_year: opened_year ? parseInt(opened_year) : undefined,
        created_by: req.user.id,
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
router.get('/', async (_req: Request, res: Response) => {
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
            home_score: true,
            away_score: true,
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
router.get('/:id', async (req: Request, res: Response) => {
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
            season: true,
          },
        },
        games: {
          select: {
            id: true,
            date: true,
            home_team: true,
            away_team: true,
            home_score: true,
            away_score: true,
            location: true,
            group: true,
            round: true,
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
router.patch('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, logo_url, location, stadium_name, capacity, opened_year } = req.body;

    const tournament = await prisma.organization.update({
      where: { id },
      data: {
        name,
        description,
        logo_url,
        location,
        stadium_name,
        capacity: capacity ? parseInt(capacity) : undefined,
        opened_year: opened_year ? parseInt(opened_year) : undefined,
      },
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
router.post('/:id/teams', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { team_id } = req.body;

    if (!team_id) {
      return res.status(400).json({ error: 'team_id is required' });
    }

    // Link team to tournament via organization
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
router.post('/:id/games', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      home_team,
      away_team,
      date,
      location,
      group,
      round,
      stadium_name,
      stadium_capacity,
      banner_url,
    } = req.body;

    if (!home_team || !away_team || !date) {
      return res.status(400).json({ error: 'home_team, away_team, and date are required' });
    }

    const game = await prisma.game.create({
      data: {
        home_team,
        away_team,
        date: new Date(date),
        location: location || stadium_name,
        group,
        round,
        stadium_name,
        stadium_capacity: stadium_capacity ? parseInt(stadium_capacity) : undefined,
        banner_url,
        sport: 'soccer',
        season: new Date(date).getFullYear().toString(),
      },
    });

    return res.status(201).json(game);
  } catch (error: any) {
    console.error('Failed to create tournament game:', error);
    return res.status(500).json({ error: error.message || 'Failed to create game' });
  }
});

export default router;
