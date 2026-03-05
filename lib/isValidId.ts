/**
 * Validates that an ID parameter is non-null, non-empty, and has a valid format.
 * Accepts UUIDs and alphanumeric IDs with hyphens/underscores (cuid, nanoid, etc).
 */
const VALID_ID = /^[a-zA-Z0-9_-]{1,128}$/;

export function isValidId(id: string | null | undefined): id is string {
  if (!id) return false;
  const trimmed = id.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return false;
  return VALID_ID.test(trimmed);
}
