/**
 * One-off cleanup: remove the placeholder post created to grant @nico post-event
 * grace access on "Saudi Arabia vs Uruguay — FIFA World Cup 2026".
 *
 * Context: scripts/one-off/grant-event-grace-access.ts created a minimal, backdated
 * post (id cmqi8rkr20001j6qazqvyx63t) so the grace gate would accept Nico's uploads.
 * That post MUST stay until the grace window closes (2026-06-17T22:00:00Z); after that
 * the posting window is closed for everyone and the placeholder is inert. This script
 * deletes it — but only after the window has closed and only if the row still matches
 * the exact placeholder fingerprint (so it can never delete a real post by mistake).
 *
 * Idempotent: if the post is already gone, it reports that and exits 0.
 *
 * USAGE (prod):
 *   DATABASE_URL="$(railway variables --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')" \
 *     npx tsx scripts/one-off/cleanup-nico-grace-placeholder.ts          # dry-run
 *     ... cleanup-nico-grace-placeholder.ts --apply                      # delete
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const PLACEHOLDER_POST_ID = 'cmqi8rkr20001j6qazqvyx63t';
const EXPECTED_AUTHOR_ID = 'cmpcxcqiw0004plf9r0nj5xng'; // @nico
const EXPECTED_GAME_ID = 'cmq7jrkcp0035pmjvgvvo8te2';
const EXPECTED_CREATED_AT = '2026-06-15T22:01:00.000Z';
const GRACE_END = new Date('2026-06-17T22:00:00.000Z');

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`\n=== cleanup-nico-grace-placeholder (${apply ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const now = new Date();
  if (now < GRACE_END) {
    console.error(
      `REFUSING: grace window has not closed yet (now ${now.toISOString()} < ${GRACE_END.toISOString()}).\n` +
        `Deleting now would cut Nico's access early. Aborting.`
    );
    process.exit(2);
  }

  const post = await prisma.post.findUnique({
    where: { id: PLACEHOLDER_POST_ID },
    select: { id: true, author_id: true, game_id: true, content: true, media_url: true, created_at: true },
  });

  if (!post) {
    console.log(`✅ Placeholder ${PLACEHOLDER_POST_ID} already gone. Nothing to do.`);
    return;
  }

  // Fingerprint guard — never delete anything that isn't exactly the placeholder.
  const mismatches: string[] = [];
  if (post.author_id !== EXPECTED_AUTHOR_ID) mismatches.push(`author_id=${post.author_id}`);
  if (post.game_id !== EXPECTED_GAME_ID) mismatches.push(`game_id=${post.game_id}`);
  if (post.content !== null) mismatches.push(`content is not null`);
  if (post.media_url !== null) mismatches.push(`media_url is not null`);
  if (post.created_at.toISOString() !== EXPECTED_CREATED_AT)
    mismatches.push(`created_at=${post.created_at.toISOString()}`);

  if (mismatches.length) {
    console.error(
      `REFUSING: post ${PLACEHOLDER_POST_ID} does not match the placeholder fingerprint ` +
        `(${mismatches.join(', ')}). It may now hold real content. Leaving it untouched.`
    );
    process.exit(3);
  }

  console.log(`Plan: DELETE placeholder post ${PLACEHOLDER_POST_ID} (author @nico, empty, backdated).`);
  if (!apply) {
    console.log('\n[dry-run] No write performed. Re-run with --apply to delete.');
    return;
  }
  await prisma.post.delete({ where: { id: PLACEHOLDER_POST_ID } });
  console.log(`✅ Deleted placeholder post ${PLACEHOLDER_POST_ID}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
