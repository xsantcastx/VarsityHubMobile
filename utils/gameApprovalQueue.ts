/**
 * Splits season games into the two DISTINCT approval states that the season
 * screen used to conflate.
 *
 * A game can be waiting on either side:
 *   - `approval_status: 'pending'`          — awaiting THIS team's review. The
 *     viewer is a team admin who did not create it, so Approve/Reject is real.
 *   - `opponent_approval_status: 'pending'` — awaiting the OPPONENT. The viewer
 *     created it; the server refuses self-review with 403 ("You cannot review
 *     your own event"), and the opponent acts from the Approvals screen's
 *     "Game Requests" section. Rendering Approve/Reject here is a dead end.
 *
 * `manage-season.tsx` mapped BOTH to a local `status: 'pending'` and fed that
 * into one actionable queue. Keeping the two apart is the whole point of this
 * helper — callers must not re-merge them.
 */
export type SeasonApprovalGame = {
  id: string;
  approval_status?: string | null;
  opponent_approval_status?: string | null;
};

export type SeasonApprovalPartition<T extends SeasonApprovalGame> = {
  /** Actionable: this team still has to approve or reject. */
  awaitingMyReview: T[];
  /** Read-only: already approved on this side, waiting on the opponent. */
  awaitingOpponent: T[];
};

export function partitionSeasonApprovalGames<T extends SeasonApprovalGame>(
  games: T[]
): SeasonApprovalPartition<T> {
  const awaitingMyReview: T[] = [];
  const awaitingOpponent: T[] = [];

  for (const game of games ?? []) {
    // This team's own review outranks the opponent's — a game pending on both
    // is still ours to decide first, and must land in exactly one bucket.
    if (game?.approval_status === 'pending') {
      awaitingMyReview.push(game);
      continue;
    }
    if (game?.opponent_approval_status === 'pending') {
      awaitingOpponent.push(game);
    }
  }

  return { awaitingMyReview, awaitingOpponent };
}
