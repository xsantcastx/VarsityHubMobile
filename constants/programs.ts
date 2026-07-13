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
 * Display plan for the one-page-per-sport program surface: controls only
 * appear when they disambiguate something. Gender toggle only when more than
 * one gender bucket exists; level chips only when the selected gender spans
 * more than one level; a single-team program renders a plain feed.
 * Unknown/null genders bucket with coed.
 */
type ProgramLevelInput = {
  level: string | null;
  team: { id?: string | number | null; gender?: string | null } & Record<string, any>;
  games: Record<string, any>[];
};

export type ProgramDisplayPlan = {
  genderOptions: { value: TeamGender; label: string }[];
  showGenderToggle: boolean;
  levelChipsFor: (gender: string) => { value: string; label: string }[];
  entriesFor: (gender: string) => ProgramLevelInput[];
};

function genderBucket(gender: string | null | undefined): TeamGender {
  return gender === 'boys' || gender === 'girls' ? gender : 'coed';
}

export function buildProgramDisplayPlan(levels: ProgramLevelInput[]): ProgramDisplayPlan {
  const byGender = new Map<TeamGender, ProgramLevelInput[]>();
  for (const entry of levels) {
    const bucket = genderBucket(entry.team?.gender);
    byGender.set(bucket, [...(byGender.get(bucket) ?? []), entry]);
  }

  const genderOptions = GENDER_OPTIONS.filter(o => byGender.has(o.value));

  const entriesFor = (gender: string) =>
    [...(byGender.get(genderBucket(gender)) ?? [])].sort(
      (a, b) => levelRank(a.level) - levelRank(b.level)
    );

  const levelChipsFor = (gender: string) => {
    const distinct = [...new Set(entriesFor(gender).map(e => e.level ?? 'other'))];
    if (distinct.length <= 1) return [];
    return [
      { value: 'all', label: 'All' },
      ...distinct
        .sort((a, b) => levelRank(a) - levelRank(b))
        .map(level => ({ value: level, label: formatLevelLabel(level) ?? 'Other' })),
    ];
  };

  return {
    genderOptions,
    showGenderToggle: genderOptions.length > 1,
    levelChipsFor,
    entriesFor,
  };
}

export type ProgramGameRow = {
  game: Record<string, any>;
  teamId: string;
  levelLabel: string | null;
};

/**
 * The merged events feed for the current toggle/chip selection: every game of
 * the selected gender's level teams (or one level when a chip is active),
 * ascending by date with dateless games last, each tagged with its level so
 * rows stay attributable without separate team pages.
 */
export function filterProgramGames(
  plan: ProgramDisplayPlan,
  gender: string,
  level: string
): ProgramGameRow[] {
  const entries = plan
    .entriesFor(gender)
    .filter(e => level === 'all' || (e.level ?? 'other') === level);
  // The server maps a game to BOTH its home and away team, so an
  // intra-program matchup arrives in two level entries. Dedupe by game id;
  // entriesFor is level-rank sorted, so the higher level's copy wins.
  const seenGameIds = new Set<string>();
  const rows: ProgramGameRow[] = entries.flatMap(e =>
    (Array.isArray(e.games) ? e.games : [])
      .filter(game => {
        const id = game?.id != null ? String(game.id) : null;
        if (!id) return true;
        if (seenGameIds.has(id)) return false;
        seenGameIds.add(id);
        return true;
      })
      .map(game => ({
        game,
        teamId: String(e.team?.id ?? ''),
        levelLabel: formatLevelLabel(e.level),
      }))
  );
  return rows.sort((a, b) => {
    const at = a.game?.scheduled_date || a.game?.date;
    const bt = b.game?.scheduled_date || b.game?.date;
    const ams = at ? new Date(at).getTime() : NaN;
    const bms = bt ? new Date(bt).getTime() : NaN;
    if (!Number.isFinite(ams)) return 1;
    if (!Number.isFinite(bms)) return -1;
    return ams - bms;
  });
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
