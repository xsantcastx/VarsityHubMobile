import type { PrismaClient } from '@prisma/client';
import { captureException } from './sentry.js';

const MAX_FOLLOWERS = 5000;
const CHUNK_SIZE = 1000;

/**
 * Fan out a program's existing followers to a level team that was just added
 * to the program.
 *
 * This is the "team-ADD" counterpart to the follow endpoint's team fan-out:
 * when a team gains a `program_id` AFTER users already followed the program,
 * those users must get a stamped TeamFollow row for the new team — otherwise
 * that team's posts never reach them (the feed reads TeamFollow, not the
 * ProgramFollow intent ledger).
 *
 * It is EXACT, not a heuristic: it keys on the ProgramFollow ledger (who
 * actually intended to follow the program) rather than the old union-over-
 * level-teams guess. Each created TeamFollow is stamped `via_program_id` so a
 * later program-unfollow can target only the rows this program created,
 * leaving any pre-existing direct follow (via_program_id null) intact.
 *
 * Idempotent via createMany + skipDuplicates over the (user_id, team_id) PK.
 *
 * @param prisma  shared Prisma client (passed in so this is unit-testable)
 * @param programId the SportProgram whose followers fan out
 * @param teamId    the newly-added level team to stamp follows for
 */
export async function fanOutProgramFollowersToTeam(
  prisma: PrismaClient,
  programId: string,
  teamId: string
): Promise<{ created: number; truncated: boolean }> {
  const rows = await prisma.programFollow.findMany({
    where: { program_id: programId },
    select: { user_id: true },
    take: MAX_FOLLOWERS,
  });

  const truncated = rows.length === MAX_FOLLOWERS;
  let created = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const result = await prisma.teamFollow.createMany({
      data: chunk.map(({ user_id }) => ({
        user_id,
        team_id: teamId,
        via_program_id: programId,
      })),
      skipDuplicates: true,
    });
    created += result.count;
  }

  if (truncated) {
    const message =
      '[program-fanout] truncated at ' +
      MAX_FOLLOWERS +
      ' followers for program ' +
      programId +
      ' team ' +
      teamId +
      '; run the reconcile script';
    console.error(message);
    captureException(message, { programId, teamId, truncated: true });
  }

  return { created, truncated };
}
