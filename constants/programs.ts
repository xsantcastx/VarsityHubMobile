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
