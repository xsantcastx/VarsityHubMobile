import { normalizeSportToSlug, SPORTS } from './sportsTaxonomy.js';

export type InferredLevel = 'varsity' | 'jv' | 'freshman' | 'middle_school' | 'unified' | 'other';
export type InferredGender = 'boys' | 'girls' | 'coed';

const LEVEL_PATTERNS: Array<[RegExp, InferredLevel]> = [
  [/\bjunior\s+varsity\b|\bjv\b/i, 'jv'],
  [/\bvarsity\b/i, 'varsity'],
  [/\bfreshman\b|\bfrosh\b|\b9th\s*grade\b/i, 'freshman'],
  [/\bmiddle\s*school\b|\bms\b(?=\s|$)/i, 'middle_school'],
  [/\bunified\b/i, 'unified'],
];

export function inferLevelFromName(name: string): InferredLevel | null {
  for (const [re, level] of LEVEL_PATTERNS) {
    if (re.test(name)) return level;
  }
  return null;
}

export function inferGenderFromName(name: string): InferredGender {
  if (/\bgirls?\b|\blady\b|\bwomen'?s?\b/i.test(name)) return 'girls';
  if (/\bboys?\b|\bmen'?s?\b/i.test(name)) return 'boys';
  return 'coed';
}

export function inferProgramForTeam(team: {
  name: string;
  sport: string | null;
}): { sport: string; gender: InferredGender; level: InferredLevel | null } | null {
  let slug = normalizeSportToSlug(team.sport);
  if (!slug) {
    // Fall back: scan the team name for a sport label ("Varsity Football").
    const lower = team.name.toLowerCase();
    const hit = SPORTS.find(s => s.slug !== 'other' && lower.includes(s.label.toLowerCase()));
    slug = hit ? hit.slug : normalizeSportToSlug(team.name);
  }
  if (!slug || slug === 'other') return null;
  return {
    sport: slug,
    gender: inferGenderFromName(team.name),
    level: inferLevelFromName(team.name),
  };
}
