/**
 * Server-side HTML sanitization.
 * Strips all HTML tags from user-generated content before saving to the database.
 */

import sanitizeHtml from 'sanitize-html';
/** Strip all HTML tags, returning plain text. Safe for storage. */
export function stripHtml(html: string | null | undefined): string {
  if (html == null || typeof html !== 'string') return '';
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}
