import { describe, expect, it } from '@jest/globals';
import {
  buildOAuthExistingAccountConflict,
  getAvailableAuthMethods,
  getLinkedProviders,
} from '../lib/oauthAccountLinking.js';

describe('oauth account linking helpers', () => {
  it('reports all available sign-in methods for an existing account', () => {
    expect(
      getAvailableAuthMethods({
        password_hash: 'hash',
        google_id: 'google-1',
        apple_id: 'apple-1',
      })
    ).toEqual(['password', 'google', 'apple']);
  });

  it('builds a stable 409 payload for same-email OAuth conflicts', () => {
    expect(
      buildOAuthExistingAccountConflict({
        email: 'coach@example.com',
        providerLabel: 'Google',
        user: {
          password_hash: 'hash',
          google_id: null,
          apple_id: 'apple-1',
        },
      })
    ).toEqual({
      code: 'OAUTH_EXISTING_ACCOUNT_MATCH',
      email: 'coach@example.com',
      available_methods: ['password', 'apple'],
      error:
        'An account already exists for coach@example.com. Sign in to that account first, then connect Google from Settings.',
    });
  });

  it('derives linked provider flags for /auth/me and auth responses', () => {
    expect(
      getLinkedProviders({
        password_hash: null,
        google_id: 'google-1',
        apple_id: null,
      })
    ).toEqual({
      password: false,
      google: true,
      apple: false,
    });
  });
});
