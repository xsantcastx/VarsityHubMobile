/**
 * Sport Program Constants (client)
 *
 * Level/gender vocabulary + label helpers for sport programs, shared with the
 * backend program taxonomy. See docs/superpowers/specs/2026-07-09-sport-program-pivot-design.md.
 */

import { SPORT_OPTIONS } from './sports';

export type TeamLevel = 'varsity' | 'jv' | 'freshman' | 'middle_school' | 'unified' | 'other';
export type TeamGender = 'boys' | 'girls' | 'coed';

export const LEVEL_OPTIONS: { value: TeamLevel; label: string }[] = [
  { value: 'varsity', label: 'Varsity' },
  { value: 'jv', label: 'JV' },
  { value: 'freshman', label: 'Freshman' },
  { value: 'middle_school', label: 'Middle School' },
  { value: 'unified', label: 'Unified' },
  { value: 'other', label: 'Other' },
];

export const LEVEL_LABELS: Record<TeamLevel, string> = LEVEL_OPTIONS.reduce(
  (acc, { value, label }) => {
    acc[value] = label;
    return acc;
  },
  {} as Record<TeamLevel, string>
);

export const GENDER_OPTIONS: { value: TeamGender; label: string }[] = [
  { value: 'boys', label: 'Boys' },
  { value: 'girls', label: 'Girls' },
  { value: 'coed', label: 'Coed' },
];

export type ProgramSummary = {
  id: string;
  sport: string;
  name?: string | null;
};

export function formatProgramLabel(p: ProgramSummary): string {
  if (p.name) return p.name;
  const sportOption = SPORT_OPTIONS.find(s => s.slug === p.sport);
  return sportOption ? sportOption.label : p.sport;
}

/**
 * Folder label for a level team within a program page: gender (when boys/girls)
 * + level. Coed/unknown gender drops the gender word; a team with neither a
 * gendered label nor a level falls back to "Team".
 *   { gender: 'girls', level: 'varsity' } -> "Girls Varsity"
 *   { gender: 'coed',  level: 'varsity' } -> "Varsity"
 *   { gender: 'girls', level: null }      -> "Girls"
 *   { gender: null,    level: null }      -> "Team"
 */
export function formatTeamFolderLabel(team: {
  gender?: string | null;
  level?: string | null;
}): string {
  const genderPart = team.gender === 'boys' ? 'Boys' : team.gender === 'girls' ? 'Girls' : '';
  const levelPart = formatLevelLabel(team.level) ?? '';
  const label = [genderPart, levelPart].filter(Boolean).join(' ');
  return label || 'Team';
}

export function formatLevelLabel(level: string | null | undefined): string | null {
  if (!level) return null;
  return LEVEL_LABELS[level as TeamLevel] ?? null;
}

// Canonical level ordering derived from LEVEL_OPTIONS (varsity, jv, freshman,
// middle_school, unified, other). Unknown/null levels sort last.
export function levelRank(level: string | null | undefined): number {
  const idx = LEVEL_OPTIONS.findIndex(o => o.value === level);
  return idx === -1 ? LEVEL_OPTIONS.length : idx;
}

// Gender ordering within a level: boys < girls < coed < unknown/null.
export function genderRank(gender: string | null | undefined): number {
  return gender === 'boys' ? 0 : gender === 'girls' ? 1 : gender === 'coed' ? 2 : 3;
}

/**
 * One level-team of a sport program: its level, the team (with id + gender),
 * and that team's games. Input shape for `buildProgramSubTeams`.
 */
type ProgramLevelInput = {
  level: string | null;
  team: { id?: string | number | null; gender?: string | null } & Record<string, any>;
  games: Record<string, any>[];
  /** Merged games+events feed from the server; falls back to `games` if absent. */
  schedule?: Record<string, any>[];
};

/** Ascending by scheduled_date||date; games without a date sort last. */
function sortGamesAscending(games: Record<string, any>[]): Record<string, any>[] {
  return [...games].sort((a, b) => {
    const at = a?.scheduled_date || a?.date;
    const bt = b?.scheduled_date || b?.date;
    const ams = at ? new Date(at).getTime() : NaN;
    const bms = bt ? new Date(bt).getTime() : NaN;
    if (!Number.isFinite(ams)) return 1;
    if (!Number.isFinite(bms)) return -1;
    return ams - bms;
  });
}

export type ProgramSubTeam = {
  teamId: string;
  label: string;
  gender: string | null;
  level: string | null;
  games: Record<string, any>[];
  /** Merged games+events the Events tab renders (kind-tagged). Games fallback. */
  schedule: Record<string, any>[];
};

/**
 * The sub-teams of a sport as ONE tappable list — Boys Varsity, Girls JV, … —
 * ordered by level then gender, each carrying that sub-team's own games
 * (ascending by date). This is the owner's model: the whole sport is ONE page,
 * and the Events tab lets a viewer tap a sub-team to see just its upcoming
 * events. There are never separate per-sub-team public pages.
 */
export function buildProgramSubTeams(levels: ProgramLevelInput[]): ProgramSubTeam[] {
  return [...levels]
    .filter(e => e?.team?.id != null && String(e.team.id).length > 0)
    .sort(
      (a, b) =>
        levelRank(a.level) - levelRank(b.level) ||
        genderRank(a.team?.gender) - genderRank(b.team?.gender)
    )
    .map(e => ({
      teamId: String(e.team.id),
      label: formatTeamFolderLabel({ gender: e.team?.gender ?? null, level: e.level }),
      gender: e.team?.gender ?? null,
      level: e.level,
      games: sortGamesAscending(Array.isArray(e.games) ? e.games : []),
      // Prefer the server's merged schedule (games+events); fall back to games
      // so an older server response (pre-schedule) still renders.
      schedule: Array.isArray(e.schedule)
        ? e.schedule
        : sortGamesAscending(Array.isArray(e.games) ? e.games : []),
    }));
}

/**
 * Groups teams by `program_id`, preserving first-appearance order within and
 * across groups. Grouped (non-null program) sections come first; teams with a
 * null `program_id` land in a single trailing group. Shared by manage-teams
 * and my-team's picker modal — keep it a pure function of its input.
 */
export function groupTeamsByProgram<T extends { program_id: string | null }>(
  teams: T[]
): { programId: string | null; teams: T[] }[] {
  const byProgram = new Map<string | null, T[]>();
  for (const t of teams) {
    const key = t.program_id ?? null;
    const list = byProgram.get(key) ?? [];
    list.push(t);
    byProgram.set(key, list);
  }
  const groups = [...byProgram.entries()].map(([programId, ts]) => ({ programId, teams: ts }));
  // programs first (stable by first appearance), ungrouped last
  return [...groups.filter(g => g.programId !== null), ...groups.filter(g => g.programId === null)];
}
