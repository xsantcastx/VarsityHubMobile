// Shared normalization helper for organization names. Keep this aligned with
// the DB-side normalize_org_name_for_dedupe function used by organization
// duplicate checks.
export function normalizeOrganizationName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bst\.?\b/g, 'saint')
    .replace(/\bhs\b/g, 'highschool')
    .replace(/\bhigh school\b/g, 'highschool')
    .replace(/\bclub\b/g, '')
    .replace(/\bleague\b/g, '')
    .replace(/\bschool\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
