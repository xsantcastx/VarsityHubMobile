import AppLinks from '@/utils/links';

type TeamShareCandidate = {
  id?: string | null;
  is_private?: boolean | null;
};

export function canShareTeamQr(team: TeamShareCandidate | null | undefined): boolean {
  const teamId = String(team?.id ?? '').trim();
  if (!teamId || teamId.startsWith('temp-')) return false;
  return team?.is_private !== true;
}

export function getCanonicalTeamShareUrl(teamId: string): string {
  return AppLinks.team(String(teamId).trim()).webUrl;
}

