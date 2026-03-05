/**
 * If a title matches a bracket-placeholder pattern like [SAMPLE_GAME:...]
 * or any [KEY:...] / [PLACEHOLDER] template key, return a safe fallback
 * so raw template keys are never shown to the user.
 */
const BRACKET_PATTERN = /^\[.+\]$/;

export function sanitizeTitle(
  title: string | null | undefined,
  fallback = 'Game Highlight',
): string | null {
  if (!title) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;
  if (BRACKET_PATTERN.test(trimmed)) return fallback;
  return trimmed;
}
