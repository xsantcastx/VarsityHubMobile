import { describe, expect, it } from '@jest/globals';
import { formatUserLabel } from '../userDisplay';

describe('formatUserLabel', () => {
  // Owner rule: a user is recognized ONLY by their @username. Real names and
  // emails must never be front-facing, even when present.
  it('uses @username and ignores display_name and email even when present', () => {
    expect(
      formatUserLabel(
        {
          display_name: 'Jane Coach',
          username: 'jane',
          email: 'jane@example.com',
        },
        'Unknown User'
      )
    ).toBe('@jane');
  });

  it('trims whitespace around the username', () => {
    expect(
      formatUserLabel(
        {
          display_name: '   ',
          username: '  jane  ',
          email: 'jane@example.com',
        },
        'Unknown User'
      )
    ).toBe('@jane');
  });

  it('NEVER falls back to email, even when username is missing', () => {
    const label = formatUserLabel(
      {
        id: 'abc-123-def-4567',
        display_name: 'Jane Coach',
        username: null,
        email: 'jane@example.com',
      },
      'Unknown User'
    );
    expect(label).not.toBe('jane@example.com');
    expect(label).not.toBe('Jane Coach');
    // Falls back to a non-identifying short id instead.
    expect(label).toBe('User 4567');
  });

  it('returns the provided fallback when there is no username and no id', () => {
    expect(
      formatUserLabel(
        {
          display_name: 'Jane Coach',
          username: '   ',
          email: 'jane@example.com',
        },
        'Unknown User'
      )
    ).toBe('Unknown User');
  });

  it('uses an id-based label when username is empty but id exists', () => {
    expect(
      formatUserLabel(
        {
          id: 'abc-123-def-4567',
          display_name: null,
          username: null,
          email: null,
        },
        'Unknown User'
      )
    ).toBe('User 4567');
  });
});
