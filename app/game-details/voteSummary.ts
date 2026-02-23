export type VoteOption = 'A' | 'B';

export type VoteSummary = {
  teamA: number;
  teamB: number;
  total: number;
  pctA: number;
  pctB: number;
  userVote: VoteOption | null;
};

export const buildVoteSummary = (
  teamA: number,
  teamB: number,
  userVote: VoteOption | null,
): VoteSummary => {
  const safeA = Math.max(0, teamA);
  const safeB = Math.max(0, teamB);
  const total = safeA + safeB;
  const pctA = total ? Math.round((safeA / total) * 100) : 0;
  const pctB = total ? 100 - pctA : 0;
  return { teamA: safeA, teamB: safeB, total, pctA, pctB, userVote };
};

export const parseVoteSummary = (payload: any): VoteSummary => {
  const teamA = typeof payload?.teamA === 'number' ? payload.teamA : 0;
  const teamB = typeof payload?.teamB === 'number' ? payload.teamB : 0;
  const userVote: VoteOption | null =
    payload?.userVote === 'A' || payload?.userVote === 'B' ? payload.userVote : null;
  return buildVoteSummary(teamA, teamB, userVote);
};

export const applyVoteSelection = (
  prev: VoteSummary | null,
  team: VoteOption,
): VoteSummary => {
  const baseline = prev ?? buildVoteSummary(0, 0, null);
  if (baseline.userVote === team) {
    return baseline;
  }
  let nextA = baseline.teamA;
  let nextB = baseline.teamB;
  if (baseline.userVote === 'A') nextA = Math.max(0, nextA - 1);
  if (baseline.userVote === 'B') nextB = Math.max(0, nextB - 1);
  if (team === 'A') nextA += 1;
  else nextB += 1;
  return buildVoteSummary(nextA, nextB, team);
};

export const applyClearVote = (prev: VoteSummary | null): VoteSummary | null => {
  if (!prev?.userVote) return prev;
  const nextA = prev.userVote === 'A' ? Math.max(0, prev.teamA - 1) : prev.teamA;
  const nextB = prev.userVote === 'B' ? Math.max(0, prev.teamB - 1) : prev.teamB;
  return buildVoteSummary(nextA, nextB, null);
};
