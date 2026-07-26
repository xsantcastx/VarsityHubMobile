import { SPORT_OPTIONS } from '@/constants/sports';
import { formatTeamFolderLabel, genderRank, levelRank } from '@/constants/programs';

/**
 * A team the signed-in user can act for, as returned by `Team.managed()`.
 */
export type PickerTeam = {
  id: string;
  name: string;
  sport?: string | null;
  program_id?: string | null;
  level?: string | null;
  gender?: string | null;
};

export type PickerSubTeam = {
  id: string;
  name: string;
  level: string | null;
  gender: string | null;
  /** Gender + level folder label, e.g. "Boys Varsity"; falls back to the name. */
  label: string;
};

export type PickerSport = {
  /** program_id for grouped sports, else the team id for ungrouped ones. */
  key: string;
  /** Sport label ("Basketball") for a program, or the team name when ungrouped. */
  label: string;
  sport: string | null;
  teams: PickerSubTeam[];
  /** True when there is exactly one team — the UI selects it without a 2nd step. */
  isSingle: boolean;
};

function sportLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return SPORT_OPTIONS.find(s => s.slug === slug)?.label ?? slug;
}

function toSubTeam(team: PickerTeam): PickerSubTeam {
  const label = formatTeamFolderLabel({ gender: team.gender, level: team.level });
  return {
    id: team.id,
    name: team.name,
    level: team.level ?? null,
    gender: team.gender ?? null,
    // Prefer the gender+level folder label; fall back to the raw team name when
    // it carries neither (formatTeamFolderLabel returns the generic "Team").
    label: label === 'Team' ? team.name : label,
  };
}

/**
 * Group the user's manageable teams into the sport -> sub-team cascade the
 * "Select Your Team" picker renders.
 *
 * Teams sharing a `program_id` are one sport with sibling level teams; each
 * ungrouped (null-program) team is its own single-team sport labeled by name.
 * Sub-teams are ordered by gender then level; sports are ordered alphabetically.
 */
export function buildTeamPickerSports(teams: PickerTeam[]): PickerSport[] {
  const grouped = new Map<string, PickerTeam[]>();
  const ungrouped: PickerTeam[] = [];

  for (const team of teams ?? []) {
    const programId = team?.program_id ?? null;
    if (programId) {
      const list = grouped.get(programId) ?? [];
      list.push(team);
      grouped.set(programId, list);
    } else {
      ungrouped.push(team);
    }
  }

  const sortSubTeams = (subs: PickerSubTeam[]) =>
    subs.sort(
      (a, b) =>
        genderRank(a.gender) - genderRank(b.gender) || levelRank(a.level) - levelRank(b.level)
    );

  const sports: PickerSport[] = [];

  for (const [programId, group] of grouped.entries()) {
    const teamsInSport = sortSubTeams(group.map(toSubTeam));
    sports.push({
      key: programId,
      label: sportLabel(group[0]?.sport) ?? group[0]?.name ?? 'Sport',
      sport: group[0]?.sport ?? null,
      teams: teamsInSport,
      isSingle: teamsInSport.length === 1,
    });
  }

  for (const team of ungrouped) {
    sports.push({
      key: team.id,
      label: team.name,
      sport: team.sport ?? null,
      teams: [toSubTeam(team)],
      isSingle: true,
    });
  }

  return sports.sort((a, b) => a.label.localeCompare(b.label));
}

export default buildTeamPickerSports;
