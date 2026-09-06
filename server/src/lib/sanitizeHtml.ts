/**
 * Server-side HTML sanitization.
 * Strips all HTML tags from user-generated content before saving to the database.
 */

import sanitizeHtml from 'sanitize-html';

/**
 * sanitize-html with `allowedTags: []` HTML-encodes the surviving text, so a
 * plain name like "Swimming & Diving" comes back as "Swimming &amp; Diving" and
 * then renders literally in React Native <Text> (which does not decode entities).
 * Decode the three entities sanitize-html emits for text nodes — `&`, `<`, `>`
 * (quotes/apostrophes are left as-is by sanitize-html, so they need no decoding).
 *
 * Order matters: `&amp;` is decoded LAST so an input like "&lt;" (which
 * sanitize-html stores as "&amp;lt;") round-trips back to the literal "&lt;"
 * instead of collapsing to "<".
 *
 * Safe: every HTML-output boundary re-escapes these characters on render (emails
 * via escapeHtml, web via React), and real tags were already removed by
 * sanitize-html before this runs — only literal stray angle brackets survive as
 * entities to be decoded. If `allowedTags` is ever widened, revisit this.
 */
function decodeStrippedEntities(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Strip all HTML tags, returning plain text. Safe for storage. */
export function stripHtml(html: string | null | undefined): string {
  if (html == null || typeof html !== 'string') return '';
  return decodeStrippedEntities(
    sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
  ).trim();
}
