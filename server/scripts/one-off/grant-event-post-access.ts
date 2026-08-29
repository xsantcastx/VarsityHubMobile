/**
 * Grant or revoke a user's 7-day regular post access to an event page.
 *
 * This writes EventPostingUnlock, the durable attendance/access ledger used by
 * verifyEventPostingPermission after the live posting window closes. It does
 * not grant story access: stories still require the event live window and venue
 * geofence unless the user is separately added as a designated poster.
 *
 * Dry-run by default:
 *   DATABASE_URL=... npx tsx server/scripts/one-off/grant-event-post-access.ts \
 *     --username @superfan --event-title "Giants" --dry-run
 *
 * Apply:
 *   DATABASE_URL=... npx tsx server/scripts/one-off/grant-event-post-access.ts \
 *     --username @superfan --event <eventId> --yes
 *
 * Flags:
 *   --user <id>              target user id
 *   --username <@username>   resolve user by username, display_name, or email
 *   --event <id>             target event id
 *   --event-title <text>     resolve by title substring; aborts if ambiguous
 *   --unlocked-at <ISO8601>  ledger anchor, default now; access lasts 7 days
 *   --clear                  revoke the ledger row
 *   --dry-run                print plan only
 *   --yes                    required to write
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const ACCESS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const has = (name: string) => process.argv.includes(`--${name}`);

async function resolveUser() {
  const userId = arg('user');
  const usernameArg = arg('username');
  const select = { id: true, username: true, display_name: true, email: true } as const;

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select });
    if (!user) throw new Error(`User not found: ${userId}`);
    return user;
  }
  if (!usernameArg) throw new Error('Required: --user <id> or --username <@username|email>');

  const needle = usernameArg.replace(/^@/, '').trim();
  const matches = await prisma.user.findMany({
    where: {
      OR: [
        { username: { equals: needle, mode: 'insensitive' } },
        { display_name: { equals: needle, mode: 'insensitive' } },
        { email: { equals: needle, mode: 'insensitive' } },
      ],
    },
    select,
    take: 25,
  });
  if (matches.length === 0) throw new Error(`No user matched "${usernameArg}"`);
  if (matches.length > 1) {
    console.error(`Ambiguous --username "${usernameArg}". Re-run with --user <id> from:`);
    for (const m of matches) {
      console.error(`  ${m.id}  @${m.username ?? '-'}  "${m.display_name ?? '-'}"  ${m.email}`);
    }
    process.exit(1);
  }
  return matches[0];
}

async function resolveEvent() {
  const eventId = arg('event');
  const eventTitle = arg('event-title');
  const select = {
    id: true,
    title: true,
    date: true,
    game_id: true,
    location: true,
  } as const;

  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select });
    if (!event) throw new Error(`Event not found: ${eventId}`);
    return event;
  }
  if (!eventTitle) throw new Error('Required: --event <id> or --event-title <text>');

  const matches = await prisma.event.findMany({
    where: { title: { contains: eventTitle, mode: 'insensitive' } },
    select,
    orderBy: { date: 'desc' },
    take: 25,
  });
  if (matches.length === 0) throw new Error(`No event matched title containing "${eventTitle}"`);
  if (matches.length > 1) {
    console.error(`Ambiguous --event-title "${eventTitle}". Re-run with --event <id> from:`);
    for (const m of matches) {
      console.error(
        `  ${m.id}  ${m.date.toISOString()}  "${m.title}"  game_id=${m.game_id ?? '-'}`
      );
    }
    process.exit(1);
  }
  return matches[0];
}

async function main() {
  const [user, event] = await Promise.all([resolveUser(), resolveEvent()]);
  const clear = has('clear');
  const apply = has('yes') && !has('dry-run');
  const unlockedAtRaw = arg('unlocked-at');
  const unlockedAt = unlockedAtRaw ? new Date(unlockedAtRaw) : new Date();
  if (Number.isNaN(unlockedAt.getTime())) {
    throw new Error(`Invalid --unlocked-at value: ${unlockedAtRaw}`);
  }
  const expiresAt = new Date(unlockedAt.getTime() + ACCESS_DURATION_MS);

  const existing = await prisma.eventPostingUnlock.findUnique({
    where: { user_id_event_id: { user_id: user.id, event_id: event.id } },
    select: { unlocked_at: true },
  });

  console.log('Grant event post access');
  console.log(`Action     : ${clear ? 'REVOKE' : 'GRANT'} 7-day regular post access`);
  console.log(`User       : @${user.username ?? '-'} ${user.display_name ?? ''} (${user.id})`);
  console.log(`Event      : ${event.title} (${event.id})`);
  console.log(`Event date : ${event.date.toISOString()}`);
  console.log(`Location   : ${event.location ?? '-'}`);
  console.log(`Game id    : ${event.game_id ?? '-'}`);
  console.log(`Existing   : ${existing ? existing.unlocked_at.toISOString() : 'none'}`);
  if (!clear) {
    console.log(`Unlock at  : ${unlockedAt.toISOString()}`);
    console.log(`Expires    : ${expiresAt.toISOString()}`);
    console.log('Stories    : not granted by this script');
  }

  if (!apply) {
    console.log('\nDRY RUN - no rows written. Re-run with --yes and without --dry-run to apply.');
    return;
  }

  if (clear) {
    await prisma.eventPostingUnlock.deleteMany({
      where: { user_id: user.id, event_id: event.id },
    });
    console.log('\nRevoked.');
    return;
  }

  await prisma.eventPostingUnlock.upsert({
    where: { user_id_event_id: { user_id: user.id, event_id: event.id } },
    create: { user_id: user.id, event_id: event.id, unlocked_at: unlockedAt },
    update: { unlocked_at: unlockedAt },
  });
  console.log('\nGranted.');
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
