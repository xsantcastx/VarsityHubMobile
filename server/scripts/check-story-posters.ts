/**
 * READ-ONLY. Reports poster_url status for recent stories so we can confirm the
 * server-side poster generation is working (after deploy + a game view triggers
 * the lazy backfill). No writes.
 *
 * Run via CI with PRODUCTION_DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isVideo = (url?: string | null): boolean => {
  if (!url) return false;
  const s = url.split('?')[0].toLowerCase();
  return ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'].some(ext => s.endsWith(ext));
};

async function main() {
  let rows: Array<{ id: string; media_url: string; poster_url: string | null; created_at: Date }>;
  try {
    rows = await prisma.story.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
      select: { id: true, media_url: true, poster_url: true, created_at: true },
    });
  } catch (err: any) {
    if (err?.code === 'P2022') {
      console.error(
        '[check-posters] poster_url column not present yet — Railway migration still pending. Re-run in a few minutes.'
      );
      process.exit(2);
    }
    throw err;
  }

  const videos = rows.filter(r => isVideo(r.media_url));
  const withPoster = videos.filter(r => r.poster_url);
  console.log(`[check-posters] recent stories: ${rows.length}`);
  console.log(`[check-posters] video stories: ${videos.length}`);
  console.log(`[check-posters] video stories WITH poster_url: ${withPoster.length}`);
  console.log('');

  // Day 1 feed-visibility check.
  const DAY1 = 'cmrblzxwi0001x1lasw8q7cc0';
  const day1 = await prisma.event.findUnique({
    where: { id: DAY1 },
    select: { date: true, title: true, live_window_hours_after_start: true },
  });
  if (day1) {
    const nowMs = Date.now();
    const eighteenHoursAgo = nowMs - 18 * 60 * 60 * 1000;
    const twoHoursAgo = nowMs - 2 * 60 * 60 * 1000;
    const d = day1.date.getTime();
    console.log(`[day1] date=${day1.date.toISOString()}  window_hours=${day1.live_window_hours_after_start ?? 'null'}`);
    console.log(`[day1] now=${new Date(nowMs).toISOString()}`);
    console.log(`[day1] visible under OLD 2h feed lookback? ${d >= twoHoursAgo ? 'YES' : 'no'}`);
    console.log(`[day1] visible under NEW 18h marquee lookback? ${d >= eighteenHoursAgo ? 'YES' : 'no'}`);
    console.log('');
  } else {
    console.log('[day1] event not found');
  }

  // Day 1 game-scoped story posters (the exact carousel the user sees).
  const day1EventFull = await prisma.event.findUnique({
    where: { id: DAY1 },
    select: { game_id: true },
  });
  let day1GameId = day1EventFull?.game_id ?? null;
  if (!day1GameId) {
    const g = await prisma.game.findFirst({
      where: { events: { some: { id: DAY1 } } },
      select: { id: true },
    });
    day1GameId = g?.id ?? null;
  }
  if (day1GameId) {
    const day1Stories = await prisma.story.findMany({
      where: { game_id: day1GameId },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: { id: true, media_url: true, poster_url: true, created_at: true },
    });
    const day1Videos = day1Stories.filter(s => isVideo(s.media_url));
    console.log(
      `[day1-stories] game=${day1GameId} total=${day1Stories.length} video=${day1Videos.length} withPoster=${day1Videos.filter(s => s.poster_url).length}`
    );
    for (const s of day1Stories) {
      const host = (() => {
        try {
          return new URL(s.media_url).hostname;
        } catch {
          return '?';
        }
      })();
      console.log(
        `  ${s.id} video=${isVideo(s.media_url)} host=${host} poster=${s.poster_url ? 'YES' : 'no'}`
      );
      if (s.poster_url) console.log(`       -> ${s.poster_url}`);
    }
    console.log('');
  } else {
    console.log('[day1-stories] no Day 1 game found');
  }

  for (const v of videos) {
    const host = (() => {
      try {
        return new URL(v.media_url).hostname;
      } catch {
        return '?';
      }
    })();
    console.log(
      `  ${v.id}  poster=${v.poster_url ? 'YES' : 'no '}  media_host=${host}  ${v.created_at.toISOString()}`
    );
    if (v.poster_url) console.log(`       -> ${v.poster_url}`);
  }
}

main()
  .catch(err => {
    console.error('[check-posters] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
