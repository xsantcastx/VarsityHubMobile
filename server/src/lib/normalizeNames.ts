// Shared normalization helper for organization names
export function normalizeOrganizationName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}
