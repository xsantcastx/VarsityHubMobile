/**
 * Unit tests for sanitizeHtml (stripHtml)
 */
import { describe, expect, it } from '@jest/globals';
import { stripHtml } from '../lib/sanitizeHtml.js';

describe('stripHtml', () => {
  it('strips all HTML tags', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
    expect(stripHtml('<b>bold</b>')).toBe('bold');
    expect(stripHtml('<script>alert(1)</script>')).toBe(''); // sanitize-html strips script content for security
  });

  it('handles nested tags', () => {
    expect(stripHtml('<div><span>nested</span></div>')).toBe('nested');
  });

  it('handles null and undefined', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
  });

  it('trims whitespace', () => {
    expect(stripHtml('  <p>text</p>  ')).toBe('text');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('handles plain text without tags', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });

  it('removes dangerous content', () => {
    expect(stripHtml('<img src=x onerror=alert(1)>')).toBe('');
    expect(stripHtml('<a href="javascript:evil()">click</a>')).toBe('click');
  });
});
