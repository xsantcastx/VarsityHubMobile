from pathlib import Path
from textwrap import dedent

path = Path(r"server/src/routes/games.ts")
text = path.read_text()

if "requireAuth" not in text:
    text = text.replace("import { z } from 'zod';\n", "import { z } from 'zod';\nimport { requireAuth } from '../middleware/requireAuth.js';\n")

helper_snippet = dedent("""
const summarizeVotes = async (gameId: string, userId?: string | null) => {
  const [teamA, teamB, mine] = await Promise.all([
    prisma.gameVote.count({ where: { game_id: gameId, team: 'A' } }),
    prisma.gameVote.count({ where: { game_id: gameId, team: 'B' } }),
    userId
      ? prisma.gameVote.findUnique({ where: { game_id_user_id: { game_id: gameId, user_id: userId } } })
      : Promise.resolve(null),
  ]);
  const total = teamA + teamB;
  const pctA = total ? Math.round((teamA / total) * 100) : 0;
  const pctB = total ? 100 - pctA : 0;
  return { teamA, teamB, total, pctA, pctB, userVote: mine?.team ?? null };
};
""")

if "const summarizeVotes" not in text:
    target = "const pickBannerUrl = (game: any, event: any | null, media: Array<{ url: string }>) => {\n  if (game?.cover_image_url) return game.cover_image_url;\n  if (event?.banner_url) return event.banner_url;\n  return media.length > 0 ? media[0]?.url ?? null : null;\n};\n\n"
    if target in text:
        text = text.replace(target, target + helper_snippet + "\n")
    else:
        raise SystemExit('Failed to locate helper insertion point')

summary_pattern = "return res.json({\n    id: game.id,\n    title: game.title,"
if summary_pattern in text:
    text = text.replace(summary_pattern, "return res.json({\n    id: game.id,\n    title: game.title,\n    homeTeam: game.home_team || null,\n    awayTeam: game.away_team || null,")
else:
    raise SystemExit('Summary payload pattern not found')

routes_snippet = dedent("""
gamesRouter.get('/:id/votes/summary', async (req: AuthedRequest, res) => {
  const gameId = String(req.params.id);
  const summary = await summarizeVotes(gameId, req.user?.id);
  res.json(summary);
});

gamesRouter.post('/:id/votes', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const gameId = String(req.params.id);
  const teamInput = String((req.body?.team ?? '')).trim().toUpperCase();
  if (teamInput !== 'A' && teamInput !== 'B') {
    return res.status(400).json({ error: 'Invalid team option' });
  }

  await prisma.gameVote.upsert({
    where: { game_id_user_id: { game_id: gameId, user_id: req.user.id } },
    update: { team: teamInput },
    create: { game_id: gameId, user_id: req.user.id, team: teamInput },
  });

  const summary = await summarizeVotes(gameId, req.user.id);
  res.json(summary);
});

gamesRouter.delete('/:id/votes', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const gameId = String(req.params.id);
  await prisma.gameVote.deleteMany({ where: { game_id: gameId, user_id: req.user.id } });
  const summary = await summarizeVotes(gameId, req.user.id);
  res.json(summary);
});
""")

insert_target = "// Posts tied to a game\ngamesRouter.get('/:id/posts',"
if insert_target in text and routes_snippet not in text:
    text = text.replace(insert_target, routes_snippet + "\n// Posts tied to a game\n" + "gamesRouter.get('/:id/posts',")
elif routes_snippet not in text:
    raise SystemExit('Unable to insert vote routes')

path.write_text(text)
