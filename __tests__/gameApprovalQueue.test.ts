/**
 * Season Approval Queue must not ask you to approve your own game.
 *
 * `manage-season.tsx` collapsed two different states into one local
 * `status: 'pending'`:
 *   - approval_status === 'pending'          -> awaiting THIS team's review
 *   - opponent_approval_status === 'pending' -> awaiting the OPPONENT's response
 *
 * The Approval Queue then rendered Approve/Reject for both. For the second
 * case the acting user is the game's creator, so the server correctly answers
 * 403 ("You cannot review your own event") — a guaranteed dead end. The
 * opponent approves from a different surface entirely (the Approvals screen's
 * "Game Requests" section), so those buttons never belonged here.
 *
 * Invariant: only games awaiting THIS team's review are actionable; games
 * waiting on the opponent are surfaced as read-only "awaiting" state.
 */

import { partitionSeasonApprovalGames } from '@/utils/gameApprovalQueue';

type G = Parameters<typeof partitionSeasonApprovalGames>[0][number];

const game = (over: Partial<G> = {}): G =>
  ({
    id: 'g1',
    approval_status: 'approved',
    opponent_approval_status: 'not_required',
    ...over,
  }) as G;

describe('partitionSeasonApprovalGames', () => {
  it('puts a game awaiting this team’s review in the actionable queue', () => {
    const res = partitionSeasonApprovalGames([game({ id: 'mine', approval_status: 'pending' })]);
    expect(res.awaitingMyReview.map(g => g.id)).toEqual(['mine']);
    expect(res.awaitingOpponent).toEqual([]);
  });

  it('does NOT make a game awaiting the opponent actionable', () => {
    const res = partitionSeasonApprovalGames([
      game({ id: 'theirs', approval_status: 'approved', opponent_approval_status: 'pending' }),
    ]);
    expect(res.awaitingMyReview).toEqual([]);
    expect(res.awaitingOpponent.map(g => g.id)).toEqual(['theirs']);
  });

  it('separates a mixed list correctly', () => {
    const res = partitionSeasonApprovalGames([
      game({ id: 'mine', approval_status: 'pending' }),
      game({ id: 'theirs', opponent_approval_status: 'pending' }),
      game({ id: 'live' }),
    ]);
    expect(res.awaitingMyReview.map(g => g.id)).toEqual(['mine']);
    expect(res.awaitingOpponent.map(g => g.id)).toEqual(['theirs']);
  });

  it('treats a declined or rejected game as neither pending bucket', () => {
    const res = partitionSeasonApprovalGames([
      game({ id: 'r', approval_status: 'rejected' }),
      game({ id: 'd', opponent_approval_status: 'declined' }),
    ]);
    expect(res.awaitingMyReview).toEqual([]);
    expect(res.awaitingOpponent).toEqual([]);
  });

  it('never places the same game in both buckets', () => {
    const res = partitionSeasonApprovalGames([
      game({ id: 'both', approval_status: 'pending', opponent_approval_status: 'pending' }),
    ]);
    const ids = [...res.awaitingMyReview, ...res.awaitingOpponent].map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tolerates missing approval fields (older payloads) without going actionable', () => {
    const res = partitionSeasonApprovalGames([{ id: 'bare' } as G]);
    expect(res.awaitingMyReview).toEqual([]);
    expect(res.awaitingOpponent).toEqual([]);
  });
});
