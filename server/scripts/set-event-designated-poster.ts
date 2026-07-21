/**
 * Grant (or revoke) a DESIGNATED POSTER on one or more events.
 *
 * A designated poster may post AND upload stories to the event page at any
 * time, from anywhere — bypassing the live window and the venue geofence —
 * WITHOUT blocking any other user (normal attendees keep the standard rules).
 * This is the deliberate post-event "give a specific person continued access
 * for marketing/continuity" grant. It is ADDITIVE and many-to-many, unlike the
 * single-user, blocks-everyone-else `exclusive_poster_id` lock.
 *
 * Enforcement: server/src/lib/geofencing.ts isDesignatedEventPoster(), checked
 * at the top of verifyEventPostingPermission and verifyStoryPostingPermission.
 *
 * Usage (dry-run by default — prints what it WOULD do, writes nothing):
 *   # look up event ids by title (also shows current designated posters)
 *   tsx server/scripts/set-event-designated-poster.ts --find "Fanatics Fest"
 *
 *   # grant one user access to several events at once (comma-separated ids)
 *   tsx server/scripts/set-event-designated-poster.ts --event id1,id2,id3,id4 --user @nicon_81 --apply
 *
 *   # revoke that user's access
 *   tsx server/scripts/set-event-designated-poster.ts --event id1,id2 --user @nicon_81 --clear --apply
 *
 *   # list who is designated on an event
 *   tsx server/scripts/set-event-designated-poster.ts --event id1 --list
 *
 * Optional --by <@handle|email> records who granted it (created_by audit column).
 */
import { prisma } from '../src/lib/prisma.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function resolveUser(userArg: string) {
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
  return user;
}

async function printDesignated(eventId: string, indent = '  ') {
  const rows = await prisma.eventDesignatedPoster.findMany({
    where: { event_id: eventId },
    select: { user_id: true, created_at: true, created_by: true },
    take: 100,
  });
  if (!rows.length) {
    console.log(`${indent}designated posters: (none)`);
    return;
  }
  const ids = rows.map(r => r.user_id);
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, display_name: true },
    take: 100,
  });
  const byId = new Map(users.map(u => [u.id, u]));
  for (const r of rows) {
    const u = byId.get(r.user_id);
    const label = u ? `@${u.username ?? u.id} (${u.display_name ?? ''})` : `${r.user_id} (deleted?)`;
    console.log(`${indent}designated poster: ${label}  granted ${r.created_at.toISOString().slice(0, 10)}`);
  }
}

async function main() {
  const find = arg('find');
  if (find) {
    const events = await prisma.event.findMany({
      where: { title: { contains: find, mode: 'insensitive' } },
      select: { id: true, title: true, date: true },
      take: 25,
      orderBy: { date: 'asc' },
    });
    console.log(`Events matching "${find}":`);
    for (const e of events) {
      console.log(`  ${e.id}  ${e.date.toISOString().slice(0, 10)}  "${e.title}"`);
      await printDesignated(e.id, '    ');
    }
    if (!events.length) console.log('  (none)');
    return;
  }

  const eventArg = arg('event');
  if (!eventArg) {
    console.error('Missing --event <eventId[,eventId2,...]>. Use --find "<title>" to look ids up.');
    process.exit(1);
  }
  const eventIds = eventArg
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // --list: just show current designated posters for the given event(s).
  if (has('list')) {
    for (const id of eventIds) {
      const event = await prisma.event.findUnique({ where: { id }, select: { id: true, title: true } });
      if (!event) {
        console.log(`${id}  (event not found)`);
        continue;
      }
      console.log(`${event.id}  "${event.title}"`);
      await printDesignated(event.id);
    }
    return;
  }

  const userArg = arg('user');
  if (!userArg) {
    console.error('Missing --user <@username|email>.');
    process.exit(1);
  }
  const user = await resolveUser(userArg);
  if (!user) {
    console.error(`No user found for "${userArg}".`);
    process.exit(1);
  }

  let createdBy: string | null = null;
  const byArg = arg('by');
  if (byArg) {
    const granter = await resolveUser(byArg);
    if (!granter) {
      console.error(`--by user "${byArg}" not found.`);
      process.exit(1);
    }
    createdBy = granter.id;
  }

  const clear = has('clear');
  const apply = has('apply');
  const action = clear ? 'REVOKE' : 'GRANT';
  const targetLabel = `@${user.username ?? user.id} — ${user.display_name ?? ''} (${user.id})`;

  // Validate every event id up front so a typo aborts before any write.
  const events = await prisma.event.findMany({
    where: { id: { in: eventIds } },
    select: { id: true, title: true },
  });
  const foundIds = new Set(events.map(e => e.id));
  const missing = eventIds.filter(id => !foundIds.has(id));
  if (missing.length) {
    console.error(`These event ids were not found: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`Action:  ${action} designated-poster access`);
  console.log(`User:    ${targetLabel}`);
  if (createdBy) console.log(`Granted by: ${createdBy}`);
  console.log('Events:');
  for (const e of events) console.log(`  ${e.id}  "${e.title}"`);

  if (!apply) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.');
    return;
  }

  for (const e of events) {
    if (clear) {
      await prisma.eventDesignatedPoster.deleteMany({
        where: { event_id: e.id, user_id: user.id },
      });
    } else {
      await prisma.eventDesignatedPoster.upsert({
        where: { event_id_user_id: { event_id: e.id, user_id: user.id } },
        create: { event_id: e.id, user_id: user.id, created_by: createdBy },
        update: {}, // idempotent — re-granting keeps the original grant row
      });
    }
  }
  console.log(
    `\n✅ ${action} applied to ${events.length} event(s). ` +
      (clear
        ? 'That user follows the normal posting rules again.'
        : 'That user can now post AND upload stories to those pages anytime, from anywhere.')
  );
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
