/**
 * One-off: grant a single user post-event GRACE-WINDOW access to a single event,
 * "as if they had already posted while it was live."
 *
 * WHY THIS WORKS:
 *   verifyEventPostingPermission() (server/src/lib/geofencing.ts) lets a user post
 *   during the post-event grace window (event start +2h .. +48h) ONLY if they have a
 *   prior Post on that event's game, created during the LIVE window (start .. +2h):
 *
 *     priorLivePost = event.game_id
 *       ? Post.findFirst({ author_id, game_id: event.game_id,
 *                          deleted_at: null, created_at: { gte: start, lte: liveCutoff } })
 *       : null
 *
 *   So the minimal, reversible lever is: make the target user have exactly one such
 *   Post. If they already posted to this event (but in the grace window, so it doesn't
 *   count), we simply BACKDATE that real post's created_at into the live window. If they
 *   have no post at all, we create one minimal backdated post.
 *
 * IMPORTANT — event must have a linked game:
 *   The grace check is keyed on event.game_id. If this event has NO game_id, the lookup
 *   is hard-coded to null and NO backdated/created post can satisfy it. This script
 *   refuses to proceed in that case (a one-off can't fix it — that needs the rule change).
 *
 * USAGE (dry-run is the default; nothing is written without --apply):
 *   # against production, resolving by human-readable fields:
 *   DATABASE_URL="$(railway variables --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')" \
 *     npx tsx scripts/one-off/grant-event-grace-access.ts \
 *       --event-title "Saudi Arabia vs Uruguay" --event-date 2026-06-15 --user nico
 *
 *   # or by explicit IDs (safest — no fuzzy matching):
 *   ... grant-event-grace-access.ts --event-id <eventId> --user <username|email|userId>
 *
 *   # add --apply to actually write once the dry-run output looks right:
 *   ... --event-id <eventId> --user nico --apply
 *
 * The dry-run prints exactly which event and which user it matched (id, email, name) so
 * you can confirm before applying. Safe to re-run — it is idempotent (a user already
 * holding a qualifying live post is a no-op).
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000; // mirrors REGULAR_POST_LIVE_WINDOW_MS in geofencing.ts
const BACKDATE_OFFSET_MS = 60 * 1000; // place the qualifying post 1 min after kickoff (safely inside live window)

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  const eventId = get('--event-id');
  const eventTitle = get('--event-title');
  const eventDate = get('--event-date'); // YYYY-MM-DD (UTC day of kickoff)
  const user = get('--user');
  const apply = args.includes('--apply');

  if (!user) {
    console.error('Missing --user <username|email|userId>');
    process.exit(1);
  }
  if (!eventId && !(eventTitle && eventDate)) {
    console.error('Provide --event-id, or both --event-title and --event-date (YYYY-MM-DD).');
    process.exit(1);
  }
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    console.error('Invalid --event-date, expected YYYY-MM-DD');
    process.exit(1);
  }
  return { eventId, eventTitle, eventDate, user, apply };
}

async function resolveEvent(opts: {
  eventId?: string;
  eventTitle?: string;
  eventDate?: string;
}) {
  if (opts.eventId) {
    const ev = await prisma.event.findUnique({
      where: { id: opts.eventId },
      select: { id: true, title: true, date: true, game_id: true },
    });
    if (!ev) {
      console.error(`No event with id ${opts.eventId}`);
      process.exit(1);
    }
    return ev;
  }
  // Match by title + the UTC calendar day of kickoff.
  const dayStart = new Date(`${opts.eventDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${opts.eventDate}T23:59:59.999Z`);
  const candidates = await prisma.event.findMany({
    where: {
      title: opts.eventTitle,
      date: { gte: dayStart, lte: dayEnd },
    },
    select: { id: true, title: true, date: true, game_id: true },
    take: 10,
  });
  if (candidates.length === 0) {
    console.error(`No event titled "${opts.eventTitle}" on ${opts.eventDate} (UTC).`);
    process.exit(1);
  }
  if (candidates.length > 1) {
    console.error(`Ambiguous — ${candidates.length} events match. Re-run with --event-id:`);
    candidates.forEach((c) => console.error(`  ${c.id}  ${c.date.toISOString()}  ${c.title}`));
    process.exit(1);
  }
  return candidates[0];
}

async function resolveUser(needle: string) {
  // Try exact id / email / username first (unique), then fall back to display_name.
  const exact = await prisma.user.findFirst({
    where: {
      OR: [{ id: needle }, { email: needle }, { username: needle }],
    },
    select: { id: true, email: true, username: true, display_name: true },
  });
  if (exact) return exact;

  const byName = await prisma.user.findMany({
    where: {
      OR: [
        { username: { equals: needle, mode: 'insensitive' } },
        { display_name: { equals: needle, mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true, username: true, display_name: true },
    take: 10,
  });
  if (byName.length === 0) {
    console.error(`No user matching "${needle}" (tried id/email/username/display_name).`);
    process.exit(1);
  }
  if (byName.length > 1) {
    console.error(`Ambiguous — ${byName.length} users match "${needle}". Re-run --user with a username/email:`);
    byName.forEach((u) =>
      console.error(`  ${u.id}  ${u.email}  @${u.username ?? '—'}  "${u.display_name ?? ''}"`)
    );
    process.exit(1);
  }
  return byName[0];
}

async function main() {
  const opts = parseArgs();
  const mode = opts.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`\n=== grant-event-grace-access (${mode}) ===\n`);

  const event = await resolveEvent(opts);
  const user = await resolveUser(opts.user);

  const start = new Date(event.date);
  const liveCutoff = new Date(start.getTime() + LIVE_WINDOW_MS);
  const graceEnd = new Date(start.getTime() + 48 * 60 * 60 * 1000);

  console.log(`Event:  ${event.id}  "${event.title}"`);
  console.log(`        kickoff ${start.toISOString()}  | live window ends ${liveCutoff.toISOString()}`);
  console.log(`        grace window ends ${graceEnd.toISOString()}`);
  console.log(`Game:   ${event.game_id ?? '(none)'}`);
  console.log(`User:   ${user.id}  ${user.email}  @${user.username ?? '—'}  "${user.display_name ?? ''}"\n`);

  if (!event.game_id) {
    console.error(
      'REFUSING: this event has no linked game_id. The grace-window check is keyed on\n' +
        'event.game_id, so no backdated/created post can satisfy it. A one-off cannot grant\n' +
        'access here — this requires the rule change (event<->post linkage). Aborting.'
    );
    process.exit(2);
  }

  const target = new Date(start.getTime() + BACKDATE_OFFSET_MS);

  // Does the user already hold a QUALIFYING live post? -> idempotent no-op.
  const qualifying = await prisma.post.findFirst({
    where: {
      author_id: user.id,
      game_id: event.game_id,
      deleted_at: null,
      created_at: { gte: start, lte: liveCutoff },
    },
    select: { id: true, created_at: true },
  });
  if (qualifying) {
    console.log(
      `✅ Already qualified: post ${qualifying.id} (${qualifying.created_at.toISOString()}) ` +
        `is inside the live window. Nico can already post in the grace window. No change needed.`
    );
    return;
  }

  // Otherwise, find their earliest existing post on this event (e.g. the grace-window one
  // from the screenshot) and backdate it. Falls back to creating a minimal post.
  const earliest = await prisma.post.findFirst({
    where: { author_id: user.id, game_id: event.game_id, deleted_at: null },
    orderBy: { created_at: 'asc' },
    select: { id: true, created_at: true, type: true, content: true },
  });

  if (earliest) {
    console.log(
      `Plan: BACKDATE existing post ${earliest.id}\n` +
        `      from ${earliest.created_at.toISOString()}  ->  ${target.toISOString()}\n` +
        `      (original timestamp logged above so this is reversible)`
    );
    if (!opts.apply) {
      console.log('\n[dry-run] No write performed. Re-run with --apply to commit.');
      return;
    }
    await prisma.post.update({
      where: { id: earliest.id },
      data: { created_at: target },
    });
    console.log(`✅ Backdated post ${earliest.id} to ${target.toISOString()}.`);
  } else {
    console.log(
      `Plan: CREATE one minimal qualifying post for ${user.id} on game ${event.game_id}\n` +
        `      created_at=${target.toISOString()}, type='post'`
    );
    if (!opts.apply) {
      console.log('\n[dry-run] No write performed. Re-run with --apply to commit.');
      return;
    }
    const created = await prisma.post.create({
      data: {
        author_id: user.id,
        game_id: event.game_id,
        type: 'post',
        content: null,
        created_at: target,
      },
      select: { id: true },
    });
    console.log(`✅ Created qualifying post ${created.id} at ${target.toISOString()}.`);
  }

  console.log(
    `\nDone. ${user.username ?? user.email} now has a live-window post on "${event.title}", ` +
      `so the grace window (open until ${graceEnd.toISOString()}) will accept their uploads.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
