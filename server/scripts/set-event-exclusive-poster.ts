/**
 * One-off: designate a single exclusive poster for a specific event.
 *
 * When an event has exclusive_poster_id set, ONLY that user may post to it
 * (server/src/lib/geofencing.ts verifyEventPostingPermission). Everyone else is
 * blocked with EXCLUSIVE_POSTER_ONLY.
 *
 * Usage (dry-run by default — prints what it WOULD do, writes nothing):
 *   tsx server/scripts/set-event-exclusive-poster.ts --event <eventId> --user <@username|email>
 *   tsx server/scripts/set-event-exclusive-poster.ts --event <eventId> --user nico --apply
 *   tsx server/scripts/set-event-exclusive-poster.ts --event <eventId> --clear --apply   (remove the lock)
 *
 * Resolve an event id first if you only know the title:
 *   tsx server/scripts/set-event-exclusive-poster.ts --find "Saudi Arabia vs Uruguay"
 */
import { prisma } from '../src/lib/prisma.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const find = arg('find');
  if (find) {
    const events = await prisma.event.findMany({
      where: { title: { contains: find, mode: 'insensitive' } },
      select: { id: true, title: true, date: true, game_id: true, exclusive_poster_id: true },
      take: 25,
      orderBy: { date: 'desc' },
    });
    console.log(`Events matching "${find}":`);
    for (const e of events) {
      console.log(
        `  ${e.id}  ${e.date.toISOString().slice(0, 10)}  "${e.title}"` +
          (e.game_id ? `  (game ${e.game_id})` : '') +
          (e.exclusive_poster_id ? `  [locked to ${e.exclusive_poster_id}]` : '')
      );
    }
    if (!events.length) console.log('  (none)');
    return;
  }

  const eventId = arg('event');
  if (!eventId) {
    console.error('Missing --event <eventId>. Use --find "<title>" to look one up.');
    process.exit(1);
  }
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, exclusive_poster_id: true },
  });
  if (!event) {
    console.error(`Event ${eventId} not found.`);
    process.exit(1);
  }

  const clear = has('clear');
  let targetUserId: string | null = null;
  let targetLabel = '(cleared — normal multi-fan posting)';

  if (!clear) {
    const userArg = arg('user');
    if (!userArg) {
      console.error('Missing --user <@username|email> (or pass --clear to remove the lock).');
      process.exit(1);
    }
    const handle = userArg.replace(/^@/, '').trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: handle, mode: 'insensitive' } },
          { email: { equals: handle, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, email: true, display_name: true },
    });
    if (!user) {
      console.error(`No user found for "${userArg}".`);
      process.exit(1);
    }
    targetUserId = user.id;
    targetLabel = `${user.display_name || user.username || user.email} (${user.id})`;
  }

  const apply = has('apply');
  console.log(`Event:   ${event.id}  "${event.title}"`);
  console.log(`Current: exclusive_poster_id = ${event.exclusive_poster_id ?? '(none)'}`);
  console.log(`Set to:  ${targetUserId ?? '(none)'}  -> ${targetLabel}`);

  if (!apply) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.');
    return;
  }

  await prisma.event.update({
    where: { id: event.id },
    data: { exclusive_poster_id: targetUserId },
  });
  console.log('\n✅ Applied. Only that user can now post to this event (or lock cleared).');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
