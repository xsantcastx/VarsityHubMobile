/**
 * GDPR data export — builder domain registry coverage.
 *
 * Pins the domain list by behavior: the spec-agreed v1 scope calls out
 * 25 distinct files (profile, preferences, billing summary, teams,
 * memberships, follows, posts, comments, messages, etc.). If a future
 * refactor silently drops one, this test fails loudly before it ships.
 *
 * Pure unit test — no DB, no storage, no Prisma client access.
 */
import { describe, expect, it } from '@jest/globals';
import { DATA_EXPORT_DOMAIN_FILENAMES } from '../lib/dataExport/domainNames.js';

describe('Data export domain registry', () => {
  const EXPECTED_DOMAINS = [
    'profile.json',
    'preferences.json',
    'billing_summary.json',
    'teams_owned.json',
    'team_memberships.json',
    'team_follows.json',
    'program_follows.json',
    'organization_memberships.json',
    'organization_follows.json',
    'organization_join_requests.json',
    'posts.json',
    'comments.json',
    'post_upvotes.json',
    'post_bookmarks.json',
    'follows.json',
    'blocks_initiated.json',
    'messages.json',
    'group_chat_memberships.json',
    'group_chat_messages.json',
    'events_created.json',
    'event_rsvps.json',
    'stories.json',
    'ads.json',
    'reports_submitted.json',
    'notifications_received.json',
    'parental_consent_history.json',
  ];

  it('registers every v1-scope domain', () => {
    const actual = [...DATA_EXPORT_DOMAIN_FILENAMES];
    // Compare as sets — order doesn't matter, but membership does.
    expect(new Set(actual)).toEqual(new Set(EXPECTED_DOMAINS));
  });

  it('does not accidentally introduce duplicate filenames', () => {
    const actual = [...DATA_EXPORT_DOMAIN_FILENAMES];
    const seen = new Set<string>();
    for (const name of actual) {
      expect(seen.has(name)).toBe(false);
      seen.add(name);
    }
  });

  it('has no domain file that would leak secret/auth material by name', () => {
    // Defense-in-depth against a future refactor naming an extractor
    // something like "auth_tokens.json" or "oauth.json". If a legit new
    // domain needs one of these words, update this list.
    const actual = [...DATA_EXPORT_DOMAIN_FILENAMES];
    const banned = [
      'password',
      'token',
      'refresh',
      'oauth',
      'google_id',
      'apple_id',
      'stripe_customer',
      'push_token',
      'secret',
      'admin_note',
      'moderation_note',
    ];
    for (const name of actual) {
      const lower = name.toLowerCase();
      for (const bannedWord of banned) {
        expect(lower).not.toContain(bannedWord);
      }
    }
  });
});
