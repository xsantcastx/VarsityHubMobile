/**
 * Input sanitization utilities for user-generated content
 * 
 * This module provides functions to sanitize user input before storage
 * to prevent XSS attacks and ensure data consistency.
 */

/**
 * Sanitize string input by:
 * - Trimming whitespace
 * - Removing null bytes
 * - Normalizing line breaks
 * - Limiting length
 */
export function sanitizeString(input: string | null | undefined, maxLength?: number): string {
  if (!input || typeof input !== 'string') return '';
  
  let sanitized = input
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\r\n/g, '\n') // Normalize line breaks
    .replace(/\r/g, '\n');
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize email address
 * Returns lowercase, trimmed email or empty string if invalid
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  
  const trimmed = email.trim().toLowerCase();
  
  // Basic email validation (RFC 5322 compliant regex would be too complex)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return '';
  
  return trimmed;
}

/**
 * Sanitize URL string
 * Validates and normalizes URLs
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  
  const trimmed = url.trim();
  if (!trimmed) return null;
  
  try {
    const parsed = new URL(trimmed);
    // Only allow http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    // If URL parsing fails, return null (invalid URL)
    return null;
  }
}

/**
 * Remove HTML tags from string
 * Basic HTML tag removal for plain text extraction
 */
export function stripHtmlTags(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove HTML tags (basic, not comprehensive - use DOMPurify for full HTML sanitization)
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Sanitize content for display
 * Removes potentially dangerous characters and normalizes whitespace
 */
export function sanitizeContent(content: string | null | undefined, maxLength?: number): string {
  if (!content || typeof content !== 'string') return '';
  
  let sanitized = content
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\r\n/g, '\n') // Normalize line breaks
    .replace(/\r/g, '\n');
  
  // Limit consecutive newlines
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize search query
 * Removes special characters that could be used for injection attacks
 */
export function sanitizeSearchQuery(query: string | null | undefined): string {
  if (!query || typeof query !== 'string') return '';
  
  return query
    .trim()
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .replace(/\0/g, '') // Remove null bytes
    .substring(0, 200); // Limit length
}
