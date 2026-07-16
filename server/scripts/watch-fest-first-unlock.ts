/**
 * Watches PRODUCTION for the first real Fanatics Fest posting activity — the
 * live proof that the geofenced-first-post → 7-day-unlock flow works with a
 * real attendee (the one thing the local e2e can't prove). Read-only; never
 * writes to prod.
 *
 * Polls every INTERVAL_S seconds and prints a line only when the counts change.
 * Exits 0 the moment the first EventPostingUnlock row (or fest post/story)
 * appears, so it can back a notification/alert. Ctrl-C to stop early.
 *
 *   DATABASE_URL="$(railway variables --service Postgres-TnGR --kv \
 *     | grep '^DATABASE_PUBLIC_URL=' | cut -d= -f2-)" \
 *     npx tsx server/scripts/watch-fest-first-unlock.ts
 *
 * Env: INTERVAL_S (default 120), MAX_MINUTES (default 0 = run until first hit).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FEST_EVENT_IDS = [
  'cmrblzxwi0001x1lasw8q7cc0', // Day 1
  'cmrblzxxn0003x1lanq5vn4bs', // Day 2
  'cmrblzxyc0005x1la8stvo3e0', // Day 3
  'cmrblzy070007x1lajr3u9bmi', // Day 4
];

async function snapshot() {
  const [unlocks, posts, festGameIds] = await Promise.all([
    prisma.eventPostingUnlock.count({ where: { event_id: { in: FEST_EVENT_IDS } } }),
    prisma.post.count({ where: { event_id: { in: FEST_EVENT_IDS } } }),
    prisma.event.findMany({
      where: { id: { in: FEST_EVENT_IDS }, game_id: { not: null } },
      select: { game_id: true },
      take: FEST_EVENT_IDS.length,
    }),
  ]);
  const gameIds = festGameIds.map(e => e.game_id).filter((g): g is string => !!g);
  const stories = gameIds.length
    ? await prisma.story.count({ where: { game_id: { in: gameIds } } })
    : 0;
  return { unlocks, posts, stories };
}

async function main() {
  const intervalS = Number(process.env.INTERVAL_S) || 120;
  const maxMinutes = Number(process.env.MAX_MINUTES) || 0;
  const startedIso = new Date().toISOString();
  console.log(
    `[fest-watch] Watching 4 fest events every ${intervalS}s (started ${startedIso}). ` +
      `Exits when the first unlock/post/story lands.`
  );

  let prev = await snapshot();
  console.log(`[fest-watch] baseline → unlocks=${prev.unlocks} posts=${prev.posts} stories=${prev.stories}`);
  if (prev.unlocks > 0 || prev.posts > 0 || prev.stories > 0) {
    console.log('[fest-watch] ✅ Activity ALREADY present — the flow has been exercised.');
    return 0;
  }

  let waitedS = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise(r => setTimeout(r, intervalS * 1000));
    waitedS += intervalS;
    let cur;
    try {
      cur = await snapshot();
    } catch (e) {
      console.warn(`[fest-watch] poll error (will retry): ${(e as Error).message}`);
      continue;
    }
    if (cur.unlocks !== prev.unlocks || cur.posts !== prev.posts || cur.stories !== prev.stories) {
      console.log(
        `[fest-watch] 🎉 FIRST ACTIVITY at ${new Date().toISOString()} → ` +
          `unlocks=${cur.unlocks} posts=${cur.posts} stories=${cur.stories} ` +
          `(the geofence→unlock flow works in the wild)`
      );
      return 0;
    }
    if (maxMinutes > 0 && waitedS >= maxMinutes * 60) {
      console.log(`[fest-watch] No activity after ${maxMinutes}m — stopping (still 0). Re-run to keep watching.`);
      return 1;
    }
    if (waitedS % (intervalS * 10) === 0) {
      console.log(`[fest-watch] still 0 after ${Math.round(waitedS / 60)}m…`);
    }
  }
}

main()
  .then(code => prisma.$disconnect().then(() => process.exit(code)))
  .catch(async e => {
    console.error('[fest-watch] fatal:', e);
    await prisma.$disconnect();
    process.exit(2);
  });
