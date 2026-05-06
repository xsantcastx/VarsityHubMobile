const NORMALIZED_PLACEHOLDERS = new Set([
  'no description',
  'no description provided',
  'no team description provided',
  'team description',
  'team overview',
  'about this team',
  'official team page',
]);

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.!?,:;'"`]+/g, '')
    .replace(/\s+/g, ' ');
}

export function sanitizePublicDescription(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = normalize(trimmed);
  if (NORMALIZED_PLACEHOLDERS.has(normalized)) return null;

  if (
    normalized.startsWith('welcome to the official team page') ||
    normalized.startsWith('this is the official team page')
  ) {
    return null;
  }

  return trimmed;
}
