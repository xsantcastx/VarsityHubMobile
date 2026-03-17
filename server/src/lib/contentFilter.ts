/**
 * Content filter for posts and events.
 * Rejects profanity, spam, trolling, and bullying before saving to the database.
 */

export type ContentFilterResult =
  | { valid: true; flags?: string[] }
  | { valid: false; error: string; code: string; flags?: string[] };

/** Normalize text for obfuscation detection (e.g. pr0fanity -> profanity) */
function normalizeForObfuscation(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i')
    .replace(/\|/g, 'i')
    .replace(/\*/g, '')
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/_/g, '');
}

/** Curated profanity list (clearly offensive terms). Extend as needed. */
const PROFANITY_BLOCKLIST = new Set([
  // English
  'asshole', 'bastard', 'bitch', 'bullshit', 'dick', 'fuck', 'fucking', 'fucker',
  'fuckoff', 'shit', 'shitty', 'slut', 'whore', 'wtf', 'retard', 'retarded',
  'rtrd', 'nigger', 'nigga', 'fag', 'faggot', 'fgt', 'kys', 'killyourself',
  'godie', 'hateyou',
  // Spanish
  'puta', 'puto', 'mierda', 'pendejo', 'pendeja', 'cabron', 'chingada',
  'chingar', 'verga', 'culero', 'culera', 'joto', 'marica', 'pinche',
  'coño', 'hijueputa', 'malparido', 'gonorrea', 'carepicha',
  // French
  'merde', 'putain', 'connard', 'salaud', 'enculer',
  // Portuguese
  'porra', 'caralho', 'filhodaputa', 'merda', 'viado',
]);

/** Bullying/harm phrases that should be rejected */
const BULLYING_PHRASES = [
  /\bkill\s*(your)?self\b/i,
  /\bgo\s+die\b/i,
  /\bgo\s+kill\s*(your)?self\b/i,
  /\byou\s+should\s+die\b/i,
  /\bhang\s*(your)?self\b/i,
  /\bgo\s+die\s+in\s+a\s+(hole|fire)\b/i,
  /\bno\s+one\s+likes\s+you\b/i,
  /\beveryone\s+hates\s+you\b/i,
  /\byou\s+are\s+worthless\b/i,
  /\bworthless\s+piece\s+of\s+shit\b/i,
  /\bun\s*alive\s*(your)?self\b/i,
  /\bgo\s+unalive\b/i,
  /\bkys\b/i,
];

/** Check if text contains profanity (including obfuscated) */
function checkProfanity(text: string): { found: boolean; word?: string } {
  const normalized = normalizeForObfuscation(text);
  const words = normalized.split(/\s+|[^\w]/).filter(Boolean);

  for (const word of words) {
    if (word.length < 3) continue;
    const clean = word.replace(/[^a-z]/g, '');
    if (PROFANITY_BLOCKLIST.has(clean)) return { found: true, word: clean };
    if (PROFANITY_BLOCKLIST.has(word)) return { found: true, word: word };
  }

  // Check for multi-word phrases
  const fullNormalized = normalized.replace(/\s+/g, ' ');
  for (const bad of PROFANITY_BLOCKLIST) {
    if (bad.length >= 4 && fullNormalized.includes(bad)) {
      return { found: true, word: bad };
    }
  }

  return { found: false };
}

/** Check for bullying/harm content */
function checkBullying(text: string): boolean {
  return BULLYING_PHRASES.some((re) => re.test(text));
}

/** Check for spam patterns. titleOnly: true = strict (no URLs), for titles */
function checkSpam(text: string, titleOnly = false): { isSpam: boolean; reason?: string } {
  // Excessive caps (>70% of letters) — only for body text, not titles.
  // Organization names, team names, and acronyms are often legitimately all-caps.
  if (!titleOnly) {
    const letters = text.replace(/\s/g, '').replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 10) {
      const caps = (letters.match(/[A-Z]/g) || []).length;
      if (caps / letters.length > 0.7) {
        return { isSpam: true, reason: 'excessive_caps' };
      }
    }
  }

  // Repeated characters (5+ same char in a row)
  if (/(.)\1{4,}/.test(text)) {
    return { isSpam: true, reason: 'repeated_characters' };
  }

  // URLs in titles or short content
  if ((titleOnly || text.length < 100) && /\bhttps?:\/\//i.test(text)) {
    return { isSpam: true, reason: 'url_in_title' };
  }

  // Promotional spam
  if (/\b(?:free|win|winning|prize|click\s+here|cash|money)\s+(?:now|today|here)\b/i.test(text)) {
    return { isSpam: true, reason: 'promotional_spam' };
  }

  return { isSpam: false };
}

/** Check for trolling patterns (flag only, not block) */
function checkTrolling(text: string): boolean {
  const lower = text.toLowerCase();
  const trollingPatterns = [
    /(?:lol|haha|hahaha){5,}/i,           // Repeated 5+ times
    /\b(?:cry|crying)\s*(?:more|baby)\b/i,
    /\b(?:mad|salty)\s*(?:cuz|because)\b/i,
    /\b(?:git\s+good|get\s+good)\b/i,
    /\b(?:skill\s+issue|skill\s+diff)\b/i,
  ];
  return trollingPatterns.some((re) => re.test(lower));
}

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
 * Validate content before saving. Returns valid: true or valid: false with error.
 * Call with title and/or content (body). Titles get stricter spam checks (no URLs).
 */
export function validateContent(fields: {
  title?: string | null;
  content?: string | null;
  description?: string | null;
}): ContentFilterResult {
  const title = fields.title?.trim() || '';
  const content = fields.content?.trim() || '';
  const description = fields.description?.trim() || '';

  const combined = [title, content, description].filter(Boolean).join(' ');
  if (!combined.trim()) return { valid: true };

  const flags: string[] = [];

  // 1. Profanity check
  const profanity = checkProfanity(combined);
  if (profanity.found) {
    return {
      valid: false,
      error: 'Your content contains inappropriate language. Please remove it and try again.',
      code: 'PROFANITY_DETECTED',
      flags: ['profanity'],
    };
  }

  // 2. Bullying/harm check
  if (checkBullying(combined)) {
    return {
      valid: false,
      error: 'Your content contains harmful or bullying language. Please keep our community safe and respectful.',
      code: 'BULLYING_DETECTED',
      flags: ['bullying'],
    };
  }

  // 3. Spam check - titles get strict check (no URLs)
  if (title) {
    const titleSpam = checkSpam(title, true);
    if (titleSpam.isSpam) {
      return {
        valid: false,
        error: 'Your title contains spam or links. Please use a clear, descriptive title without URLs.',
        code: 'SPAM_DETECTED',
        flags: ['spam', titleSpam.reason || 'unknown'],
      };
    }
  }
  const contentSpam = checkSpam(combined, false);
  if (contentSpam.isSpam) {
    return {
      valid: false,
      error: 'Your content appears to be spam. Please remove promotional content and try again.',
      code: 'SPAM_DETECTED',
      flags: ['spam', contentSpam.reason || 'unknown'],
    };
  }

  // 4. Trolling (flag but don't block - could be legitimate)
  if (checkTrolling(combined)) {
    flags.push('possible_trolling');
  }

  // 5. Negative sentiment (flag but don't block)
  const sentimentScore = scoreSentiment(combined);
  if (sentimentScore >= 0.4) {
    flags.push('negative_sentiment');
  }

  if (flags.length > 0) {
    return { valid: true, flags };
  }
  return { valid: true };
}
