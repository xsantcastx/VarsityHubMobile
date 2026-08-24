/**
 * Server-side HTML sanitization.
 * Strips all HTML tags from user-generated content before saving to the database.
 */

import sanitizeHtml from 'sanitize-html';

/** Strip all HTML tags, returning plain text. Safe for storage. */
export function stripHtml(html: string | null | undefined): string {
  if (html == null || typeof html !== 'string') return '';
  const stripped = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  // sanitize-html re-escapes the 5 basic HTML entities when serializing text
  // nodes even with no tags allowed (e.g. "Swimming & Diving" -> "Swimming
  // &amp; Diving"), which is correct for HTML output but wrong for plain-text
  // storage — decode them back so callers get the literal text they passed in.
  return stripped
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}
