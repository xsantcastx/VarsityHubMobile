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

  // Regression: sanitize-html with allowedTags:[] HTML-encodes text, turning a
  // name like "Swimming & Diving" into "Swimming &amp; Diving", which then renders
  // literally in React Native <Text>. stripHtml must return true plain text.
  it('does not HTML-encode literal ampersands', () => {
    expect(stripHtml('Swimming & Diving')).toBe('Swimming & Diving');
    expect(stripHtml('Track & Field')).toBe('Track & Field');
    expect(stripHtml('R&B')).toBe('R&B');
  });

  it('does not HTML-encode literal angle brackets left after tag stripping', () => {
    expect(stripHtml('Rock < Roll > Jazz')).toBe('Rock < Roll > Jazz');
  });

  it('strips tags but keeps surrounding literal entities decoded', () => {
    expect(stripHtml('A<b>x</b>B & C')).toBe('AxB & C');
  });
});
