/**
 * Content filter for posts and events.
 * Disabled — users can post freely. Moderation happens via user reports.
 */

export type ContentFilterResult =
  | { valid: true; flags?: string[] }
  | { valid: false; error: string; code: string; flags?: string[] };

/**
 * Basic negative sentiment scoring (lightweight, no ML).
 * Returns a score 0-1 where higher = more negative.
 * Used for flagging, not blocking.
 */
export function scoreSentiment(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  const negativePatterns = [
    { re: /\b(?:hate|despise|loathe)\b/gi, weight: 0.15 },
    { re: /\b(?:stupid|idiot|dumb|moron|loser)\b/gi, weight: 0.2 },
    { re: /\b(?:ugly|disgusting|pathetic|trash|garbage)\b/gi, weight: 0.15 },
    { re: /\b(?:worst|terrible|horrible|awful)\b/gi, weight: 0.1 },
    { re: /\b(?:shut\s+up|stfu|gtfo|get\s+lost)\b/gi, weight: 0.2 },
    { re: /\b(?:nobody\s+cares|who\s+asked|didn'?t\s+ask)\b/gi, weight: 0.15 },
    { re: /\b(?:clown|joke|embarrassing|cringe)\b/gi, weight: 0.1 },
  ];
  for (const { re, weight } of negativePatterns) {
    const matches = lower.match(re);
    if (matches) score += weight * matches.length;
  }
  return Math.min(score, 1);
}

/**
 * Validate content before saving. Always returns valid.
 * Content moderation is handled via user reports, not pre-screening.
 */
export function validateContent(_fields: {
  title?: string | null;
  content?: string | null;
  description?: string | null;
}): ContentFilterResult {
  return { valid: true };
}
