/**
 * Canonical list of data-export domain filenames.
 *
 * Kept in its own pure module — no Prisma, no storage, no side-effects —
 * so the registry-coverage unit test can import it without pulling the
 * entire Prisma client into Jest's CommonJS runtime (which breaks on
 * import.meta under the project's test harness).
 *
 * Source of truth. The builder iterates extractors with filenames that
 * MUST match these strings; the coverage test pins both sides.
 */
export const DATA_EXPORT_DOMAIN_FILENAMES = [
  'profile.json',
  'preferences.json',
  'billing_summary.json',
  'teams_owned.json',
  'team_memberships.json',
  'team_follows.json',
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
] as const;

export type DataExportDomainFilename = (typeof DATA_EXPORT_DOMAIN_FILENAMES)[number];
