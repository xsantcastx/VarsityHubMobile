export type VoteTeam = 'A' | 'B';

export type BinaryVoteSummary = {
  teamA: number;
  teamB: number;
  total: number;
  pctA: number;
  pctB: number;
  userVote: VoteTeam | null;
};

export const normalizeVoteTeam = (team?: string | null): VoteTeam | null =>
  team === 'A' || team === 'B' ? team : null;

export const buildBinaryVoteSummary = (
  teamA: number,
  teamB: number,
  userVote?: string | null
): BinaryVoteSummary => {
  const safeA = Math.max(0, teamA);
  const safeB = Math.max(0, teamB);
  const total = safeA + safeB;
  const pctA = total ? Math.round((safeA / total) * 100) : 0;
  const pctB = total ? 100 - pctA : 0;
  return {
    teamA: safeA,
    teamB: safeB,
    total,
    pctA,
    pctB,
    userVote: normalizeVoteTeam(userVote),
  };
};
