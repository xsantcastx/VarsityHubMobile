// Leagues that exist purely as an admin-curated demo/showcase (currently the
// International Cup 2026 bracket — see scripts/fifa/*). These teams are meant to
// stay fully browsable everywhere content is discovered (feed, search, game
// pages), but they aren't real VarsityHub teams a coach can challenge to a
// match — so opponent-selection flows opt in to excluding them.
// NOTE: this must match the ORGANIZATION.name seeded by scripts/fifa/worldcup-2026.data.ts.
export const DEMO_LEAGUE_NAMES = ['International Cup 2026'] as const;
