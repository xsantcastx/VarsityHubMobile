// A Game row is only a competitive matchup when its event_type is unset or
// literally 'game' — this mirrors the server's canonical rule exactly
// (isCompetitivePollEventType in server/src/routes/games.ts).
// Non-competitive events (fundraiser, watch party, team trip, meeting, team
// meal, other) are Game rows too — they must show their own title, never
// "vs TBD".
export function gameRowTitle(g: {
  title?: string | null;
  event_type?: string | null;
  away_team?: string | null;
  away_team_name?: string | null;
  opponent?: string | null;
}): string {
  const opponent = (g.opponent || g.away_team || g.away_team_name || '').trim();
  const et = (g.event_type || '').trim().toLowerCase();
  const isCompetitive = et === '' || et === 'game';
  if (isCompetitive) return `vs ${opponent || 'TBD'}`;
  return (g.title || '').trim() || eventTypeLabel(g.event_type);
}

function eventTypeLabel(t?: string | null): string {
  switch ((t || '').trim().toLowerCase()) {
    case 'fundraiser':
      return 'Fundraiser';
    case 'watch_party':
      return 'Watch Party';
    case 'team_trip':
      return 'Team Trip';
    case 'meeting':
      return 'Meeting';
    case 'team_meal':
      return 'Team Meal';
    default:
      return 'Event';
  }
}
