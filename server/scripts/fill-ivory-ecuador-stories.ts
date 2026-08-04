/**
 * Marketing fill: promote 3 of the Ivory Coast vs Ecuador posts to permanent
 * event-page stories. Owner-authorized manual op (2026-08-03).
 *
 *  - game_id  : cmq7jrjoj002ppmjv2834ssyh  (backing game of the event page)
 *  - stories are permanent: expires_at left NULL (list handler never filters
 *    NULL; lazy cleanup only deletes expires_at < now()).
 *  - attributed to the original poster so they read as authentic fan stories.
 *  - idempotent: skips a post if a story with the same media_url already exists.
 *
 * DRY RUN by default. Pass --commit to write.
 * Run: DATABASE_URL=<public> npx tsx scripts/fill-ivory-ecuador-stories.ts [--commit]
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const GAME_ID = 'cmq7jrjoj002ppmjv2834ssyh';
const COMMIT = process.argv.includes('--commit');

// The 3 chosen posts (spread across the set for visual variety).
const CHOSEN_POST_IDS = [
  'cmqeaizhh0003lvzaynqnoj6w', // [1]
  'cmqeetxgc000olvzab3h6al8t', // [3]
];

async function main() {
  const posts = await prisma.post.findMany({
    where: { id: { in: CHOSEN_POST_IDS }, game_id: GAME_ID, deleted_at: null },
    select: { id: true, author_id: true, media_url: true, poster_url: true, content: true, created_at: true },
  });
  if (posts.length !== CHOSEN_POST_IDS.length) {
    throw new Error(`Expected ${CHOSEN_POST_IDS.length} posts, found ${posts.length}`);
  }
  // Preserve the CHOSEN order
  posts.sort((a, b) => CHOSEN_POST_IDS.indexOf(a.id) - CHOSEN_POST_IDS.indexOf(b.id));

  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY RUN'} | game ${GAME_ID}\n`);
  const created: string[] = [];

  for (const p of posts) {
    const exists = await prisma.story.findFirst({
      where: { game_id: GAME_ID, media_url: p.media_url! },
      select: { id: true },
    });
    if (exists) {
      console.log(`SKIP (story exists ${exists.id}) for post ${p.id}`);
      continue;
    }
    const data = {
      game_id: GAME_ID,
      user_id: p.author_id,
      media_url: p.media_url!,
      poster_url: p.poster_url ?? undefined,
      caption: p.content ?? undefined,
      created_at: p.created_at, // anchor to game day
      // expires_at intentionally omitted => NULL => permanent
    };
    if (!COMMIT) {
      console.log(`WOULD CREATE story from post ${p.id} ->`, JSON.stringify({ media: data.media_url, user: data.user_id }));
      continue;
    }
    const s = await prisma.story.create({ data, select: { id: true } });
    created.push(s.id);
    console.log(`CREATED story ${s.id} from post ${p.id}`);
  }

  const total = await prisma.story.count({ where: { game_id: GAME_ID } });
  console.log(`\nStories now on game: ${total}`);
  if (created.length) {
    console.log('New story ids (for undo):', created.join(', '));
    console.log(`Undo: DELETE FROM "Story" WHERE id IN (${created.map(i => `'${i}'`).join(', ')});`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
