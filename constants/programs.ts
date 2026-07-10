/**
 * Sport Program Constants (client)
 *
 * Level/gender vocabulary + label helpers for sport programs, shared with the
 * backend program taxonomy. See docs/superpowers/specs/2026-07-09-sport-program-pivot-design.md.
 */

import { SPORT_OPTIONS } from './sports';

export type TeamLevel = 'varsity' | 'jv' | 'freshman' | 'middle_school' | 'unified' | 'other';
export type ProgramGender = 'boys' | 'girls' | 'coed';

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

export const GENDER_OPTIONS: { value: ProgramGender; label: string }[] = [
  { value: 'boys', label: 'Boys' },
  { value: 'girls', label: 'Girls' },
  { value: 'coed', label: 'Coed' },
];

export type ProgramSummary = {
  id: string;
  sport: string;
  gender: ProgramGender;
  name?: string | null;
};

export function formatProgramLabel(p: ProgramSummary): string {
  if (p.name) return p.name;
  const sportOption = SPORT_OPTIONS.find(s => s.slug === p.sport);
  const sportLabel = sportOption ? sportOption.label : p.sport;
  if (p.gender === 'coed') return sportLabel;
  const genderOption = GENDER_OPTIONS.find(g => g.value === p.gender);
  const genderLabel = genderOption ? genderOption.label : '';
  return genderLabel ? `${genderLabel} ${sportLabel}` : sportLabel;
}

export function formatLevelLabel(level: string | null | undefined): string | null {
  if (!level) return null;
  return LEVEL_LABELS[level as TeamLevel] ?? null;
}
