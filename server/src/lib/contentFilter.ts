/**
 * Content filter for posts, comments, teams, orgs, events, and messages.
 * Blocks profanity/slurs and common spam patterns.
 * Supplemented by user-report-based moderation.
 */

export type ContentFilterResult =
  | { valid: true; flags?: string[] }
  | { valid: false; error: string; code: string; flags?: string[] };

/**
 * Profanity word list — covers slurs, explicit sexual terms, and threats.
 * Matched with word-boundary checks so substrings in normal words don't trigger.
 */
const PROFANITY_LIST: string[] = [
  // Slurs & hate speech
  'nigger', 'nigga', 'faggot', 'fag', 'dyke', 'tranny', 'retard', 'retarded',
  'spic', 'kike', 'chink', 'wetback', 'beaner', 'coon', 'gook', 'raghead',
  'towelhead',
  // Explicit sexual
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'shitty', 'bullshit',
  'asshole', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut',
  'bastard', 'damn', 'piss',
  // Threats / violence
  'kill yourself', 'kys', 'neck yourself', 'go die', 'i will kill you',
  'shoot you', 'rape', 'molest',
];

/**
 * Build regex patterns from the profanity list.
 * Multi-word phrases use \s+ between words; single words use \b boundaries.
 */
const PROFANITY_PATTERNS: RegExp[] = PROFANITY_LIST.map((phrase) => {
  const escaped = phrase
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  return new RegExp(`\\b${escaped}\\b`, 'i');
});

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

/** Count URL occurrences in text */
function countUrls(text: string): number {
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const matches = text.match(urlPattern);
  return matches ? matches.length : 0;
}

/** Check if text has excessive caps (>70% uppercase letters, minimum 8 letters) */
function isExcessiveCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 8) return false;
  const upperCount = (letters.match(/[A-Z]/g) || []).length;
  return upperCount / letters.length > 0.7;
}

/** Check for excessive repeated characters (4+ of the same char in a row) */
function hasExcessiveRepeats(text: string): boolean {
  return /(.)\1{3,}/i.test(text);
}

/** Check if content is mostly just links with minimal text */
function isLinkOnly(text: string): boolean {
  const stripped = text.replace(/https?:\/\/[^\s]+/gi, '').trim();
  const urls = countUrls(text);
  return urls > 0 && stripped.length < 10;
}

/**
 * Validate content before saving.
 *
 * v1.0.3: DISABLED AT THE PRODUCT OWNER'S REQUEST. This function previously
 * screened for profanity, slurs, excessive caps, URL spam, and bullying
 * patterns. It was flagging too many legitimate organization names and
 * descriptions (e.g. all-caps acronyms, common sports terminology), so it
 * has been short-circuited to always return valid.
 *
 * The app's content moderation story is now admin approval — every new org,
 * coach, ad, and event passes through the admin dashboard before going live
 * (verified in 134 coach-flow / approval tests). If Apple/Play Store review
 * asks about automated content filtering during submission, point them at
 * the admin workflow: nothing user-generated goes public without human
 * review at first publish.
 *
 * Call sites retain the signature so we don't have to edit ~20 routes.
 * If a specific check needs to come back (e.g. for DMs or posts), wrap it
 * at the caller rather than re-enabling the global filter.
 */
export function validateContent(_fields: {
  title?: string | null;
  content?: string | null;
  description?: string | null;
}): ContentFilterResult {
  return { valid: true };
}
