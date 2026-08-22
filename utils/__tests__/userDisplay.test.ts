import { describe, expect, it } from '@jest/globals';
import { formatUserLabel } from '../userDisplay';

// Product rule (2026-08-18): users are shown by @username only. formatUserLabel
// delegates to formatUserHandle, so it must NEVER surface display_name or email.
describe('formatUserLabel', () => {
  it('shows @username even when a display_name is present (never the real name)', () => {
    expect(
      formatUserLabel(
        { display_name: 'Jane Coach', username: 'jane', email: 'jane@example.com' },
        'Unknown User'
      )
    ).toBe('@jane');
  });

  it('shows @username when display_name is missing', () => {
    expect(
      formatUserLabel({ display_name: null, username: 'jane', email: 'jane@example.com' })
    ).toBe('@jane');
  });

  it('trims whitespace around the username', () => {
    expect(formatUserLabel({ display_name: '   ', username: '  jane  ' })).toBe('@jane');
  });

  it('never falls back to email or real name — uses the @user placeholder', () => {
    expect(
      formatUserLabel({ display_name: 'Jane Coach', username: null, email: 'jane@example.com' })
    ).toBe('@user');
  });

  it('returns @user when every field is empty (ignores the legacy fallback arg)', () => {
    expect(
      formatUserLabel({ display_name: '', username: '   ', email: null }, 'Unknown User')
    ).toBe('@user');
  });

  it('never surfaces an id-based label', () => {
    expect(
      formatUserLabel({ id: 'abc-123-def-4567', display_name: null, username: null, email: null })
    ).toBe('@user');
  });
});
