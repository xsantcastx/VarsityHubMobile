import { describe, expect, it } from '@jest/globals';
import { formatUserLabel } from '../userDisplay';

describe('formatUserLabel', () => {
  it('prefers display_name when present', () => {
    expect(formatUserLabel({
      display_name: 'Jane Coach',
      username: 'jane',
      email: 'jane@example.com',
    }, 'Unknown User')).toBe('Jane Coach');
  });

  it('falls back to @username when display_name is missing', () => {
    expect(formatUserLabel({
      display_name: null,
      username: 'jane',
      email: 'jane@example.com',
    }, 'Unknown User')).toBe('@jane');
  });

  it('trims whitespace before deciding the fallback', () => {
    expect(formatUserLabel({
      display_name: '   ',
      username: '  jane  ',
      email: 'jane@example.com',
    }, 'Unknown User')).toBe('@jane');
  });

  it('falls back to email when both display_name and username are missing', () => {
    expect(formatUserLabel({
      display_name: '',
      username: null,
      email: 'jane@example.com',
    }, 'Unknown User')).toBe('jane@example.com');
  });

  it('returns the provided fallback when all user fields are empty', () => {
    expect(formatUserLabel({
      display_name: '',
      username: '   ',
      email: null,
    }, 'Unknown User')).toBe('Unknown User');
  });
});
