// Small helper to normalize and match team names.
// Exports `normalizeName` and `findBestMatch` which finds the best matching team from a list.
export const normalizeName = (s?: string | null) => {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (basic)
    .replace(/[^a-z0-9 ]+/g, ' ') // keep alphanumeric and spaces
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
};

// Simple Levenshtein distance implementation (small datasets ok)
const levenshtein = (a: string, b: string) => {
  if (a === b) return 0;
  const al = a.length; const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const v0 = new Array(bl + 1).fill(0);
  const v1 = new Array(bl + 1).fill(0);
  for (let j = 0; j <= bl; j++) v0[j] = j;
  for (let i = 0; i < al; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < bl; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= bl; j++) v0[j] = v1[j];
  }
  return v1[bl];
};

export const findBestMatch = (teamName?: string | null, teams: Array<{ id: string; name: string; avatarUrl?: string | null }>=[]) => {
  const target = normalizeName(teamName);
  if (!target) return null;
  let best: { score: number; team: any | null } = { score: Infinity, team: null };
  for (const t of teams) {
    const n = normalizeName(t.name);
    if (!n) continue;
    if (n === target) return t;
    // quick prefix/word match
    if (n.startsWith(target) || target.startsWith(n)) return t;
    if (n.includes(target) || target.includes(n)) {
      return t;
    }
    const d = levenshtein(n, target);
    if (d < best.score) best = { score: d, team: t };
  }
  // Accept fuzzy match only if distance is reasonably small relative to length
  if (best.team && best.score <= Math.max(1, Math.floor((normalizeName(best.team.name).length) * 0.28))) {
    return best.team;
  }
  return null;
};

export default { normalizeName, findBestMatch };
