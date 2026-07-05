/**
 * "vs TBD" root cause: an opponent picked from the suggestions dropdown must
 * link the real Team row on the side the USER'S team is NOT on
 * (gameType 'home' → opponent is away; 'away' → opponent is home).
 * Free-text opponents stay display-only (name field, no id).
 */
export const buildOpponentLink = (
  gameType: string,
  opponentTeamId: string
): { home_team_id?: string; away_team_id?: string } => {
  const id = opponentTeamId.trim();
  if (!id) return {};
  if (gameType === 'home') return { away_team_id: id };
  if (gameType === 'away') return { home_team_id: id };
  return {};
};
