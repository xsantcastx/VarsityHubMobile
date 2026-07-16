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
