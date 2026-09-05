/**
 * GDPR / right-to-access data export ZIP builder.
 *
 * Given a user ID, enumerates every domain the user directly owns or
 * authored, queries the DB for their rows, strips secrets/third-party
 * identifiers/other users' PII, and assembles a ZIP of JSON files — one
 * file per domain.
 *
 * The builder is deliberately independent of the storage backend and the
 * BullMQ worker: it returns a Buffer. The caller (worker) uploads that
 * buffer to object storage. This keeps the builder unit-testable without
 * any storage fixtures.
 *
 * Exclusions (hardcoded — never include in output):
 *   - RefreshToken, password hash, verification/reset codes
 *   - OAuth ids (google_id, apple_id), Stripe customer id
 *   - Push tokens, 2FA secrets
 *   - Admin moderation notes, internal audit fields
 *   - Other users' email / phone / DOB / auth data when they appear as
 *     counterparties in messages/threads
 */

import archiver from 'archiver';
import { prisma } from '../prisma.js';
import { DATA_EXPORT_DOMAIN_FILENAMES } from './domainNames.js';
import { getCanonicalBillingState } from '../userBillingState.js';

/**
 * One domain of exported data. Each extractor returns a JSON-serializable
 * payload that becomes a single file inside the ZIP. `filename` is relative
 * to the ZIP root and should end in `.json`.
 */
interface DomainExtractor {
  filename: string;
  extract: (userId: string) => Promise<unknown>;
}

const EXPORT_ROW_LIMIT = 50_000;

function assertWithinRowLimit(value: unknown): void {
  if (Array.isArray(value)) {
    if (value.length > EXPORT_ROW_LIMIT) throw new Error('export_size_limit');
    return;
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) assertWithinRowLimit(child);
  }
}

// Explicit allowlist: preferences also holds provider receipts, tokens and
// internal moderation state. Unknown keys must not silently enter an archive.
export function exportPreferences(value: unknown): Record<string, unknown> {
  const prefs =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const keys = [
    'theme',
    'affiliation',
    'sports_interests',
    'personalization_goals',
    'primary_intents',
    'season_start',
    'season_end',
    'location_enabled',
    'notifications_enabled',
    'messaging_policy_accepted',
    'profile_private',
    'comment_permission',
    'dm_policy',
    'location',
    'header_image_url',
    'header_image_focus_y',
    'theme_color',
    'position',
    'jersey_number',
    'grade_level',
    'graduation_year',
    'accolades',
    'primary_sport',
    'zip_code',
    'is_parent',
  ];
  const result = Object.fromEntries(keys.filter(key => key in prefs).map(key => [key, prefs[key]]));
  if (
    prefs.notifications &&
    typeof prefs.notifications === 'object' &&
    !Array.isArray(prefs.notifications)
  ) {
    const notifications = prefs.notifications as Record<string, unknown>;
    const notificationKeys = [
      'game_event_reminders',
      'team_updates',
      'comments_upvotes',
      'follows_notifications',
      'messages_notifications',
    ];
    result.notifications = Object.fromEntries(
      notificationKeys
        .filter(key => typeof notifications[key] === 'boolean')
        .map(key => [key, notifications[key]])
    );
  }
  return result;
}

// ─── Domain extractors ───────────────────────────────────────────────────────

const DOMAINS: DomainExtractor[] = [
  {
    filename: 'profile.json',
    extract: async userId => {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          display_name: true,
          username: true,
          avatar_url: true,
          bio: true,
          role: true,
          onboarding_completed: true,
          terms_accepted_at: true,
          terms_version: true,
          coach_agreement_accepted_at: true,
          coach_agreement_version: true,
          date_of_birth: true,
          created_at: true,
          email_verified: true,
          approval_status: true,
          subscription_tier: true,
          subscription_status: true,
          max_teams: true,
          parent_email: true,
          parental_consent_status: true,
          parental_consent_at: true,
        },
      });
      return u ?? null;
    },
  },
  {
    filename: 'preferences.json',
    extract: async userId => {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      return exportPreferences(u?.preferences);
    },
  },
  {
    filename: 'billing_summary.json',
    extract: async userId => {
      // Derived summary only — no raw Stripe objects. Source of truth is
      // User.subscription_* fields plus preferences.plan / apple_* metadata.
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          subscription_tier: true,
          subscription_status: true,
          max_teams: true,
          paid_by_owner: true,
          plan: true,
          pending_plan: true,
          payment_pending: true,
          payment_approved: true,
          preferences: true,
        },
      });
      if (!u) return null;
      const prefs = (u.preferences ?? {}) as Record<string, unknown>;
      const billing = getCanonicalBillingState(u);
      return {
        subscription_tier: u.subscription_tier,
        subscription_status: u.subscription_status,
        max_teams: u.max_teams,
        paid_by_owner: u.paid_by_owner ?? false,
        plan: billing.plan,
        pending_plan: billing.pending_plan,
        payment_pending: billing.payment_pending,
        payment_approved: billing.payment_approved,
        apple_product_id: prefs.apple_product_id ?? null,
        apple_expires_date: prefs.apple_expires_date ?? null,
        grace_period_expires_at: prefs.grace_period_expires_at ?? null,
      };
    },
  },
  {
    filename: 'teams_owned.json',
    extract: async userId =>
      prisma.team.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { memberships: { some: { user_id: userId, role: 'owner', status: 'active' } } },
        select: {
          id: true,
          name: true,
          sport: true,
          created_at: true,
          city: true,
          state: true,
          organization_id: true,
          is_private: true,
        },
      }),
  },
  {
    filename: 'team_memberships.json',
    extract: async userId =>
      prisma.teamMembership.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: {
          team_id: true,
          role: true,
          status: true,
          custom_position: true,
          created_at: true,
        },
      }),
  },
  {
    filename: 'team_follows.json',
    extract: async userId =>
      prisma.teamFollow.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: { team_id: true, created_at: true },
      }),
  },
  {
    filename: 'program_follows.json',
    extract: async userId =>
      prisma.programFollow.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: { program_id: true, created_at: true },
      }),
  },
  {
    filename: 'organization_memberships.json',
    extract: async userId =>
      prisma.organizationMembership.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: { organization_id: true, role: true, status: true, created_at: true },
      }),
  },
  {
    filename: 'organization_follows.json',
    extract: async userId =>
      prisma.organizationFollow.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: { organization_id: true, created_at: true },
      }),
  },
  {
    filename: 'organization_join_requests.json',
    extract: async userId =>
      prisma.organizationJoinRequest.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: {
          organization_id: true,
          status: true,
          message: true,
          created_at: true,
          reviewed_at: true,
        },
      }),
  },
  {
    filename: 'posts.json',
    extract: async userId =>
      prisma.post.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { author_id: userId },
        select: {
          id: true,
          content: true,
          media_url: true,
          created_at: true,
          team_id: true,
          deleted_at: true,
          upvotes_count: true,
        },
      }),
  },
  {
    filename: 'comments.json',
    extract: async userId =>
      prisma.comment.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { author_id: userId },
        select: {
          id: true,
          post_id: true,
          content: true,
          created_at: true,
          parent_id: true,
        },
      }),
  },
  {
    filename: 'post_upvotes.json',
    extract: async userId =>
      prisma.postUpvote.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: { post_id: true, created_at: true },
      }),
  },
  {
    filename: 'post_bookmarks.json',
    extract: async userId =>
      prisma.postBookmark.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: { post_id: true, created_at: true },
      }),
  },
  {
    filename: 'follows.json',
    extract: async userId => {
      const [following, followers] = await Promise.all([
        prisma.follows.findMany({
          take: EXPORT_ROW_LIMIT + 1,
          where: { follower_id: userId },
          select: { following_id: true, created_at: true, status: true },
        }),
        prisma.follows.findMany({
          take: EXPORT_ROW_LIMIT + 1,
          where: { following_id: userId },
          select: { follower_id: true, created_at: true, status: true },
        }),
      ]);
      return { following, followers };
    },
  },
  {
    filename: 'blocks_initiated.json',
    extract: async userId =>
      // Only blocks the user INITIATED. Blocks against them are others'
      // data and deliberately excluded from this export.
      prisma.blockedUser.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { blocker_id: userId },
        select: { blocked_id: true, created_at: true },
      }),
  },
  {
    filename: 'messages.json',
    extract: async userId => {
      // Both directions — user's own sent + messages received. For each
      // message, we include minimal counterparty identity (user_id,
      // display_name, avatar_url) — NOT email, phone, DOB, or auth data.
      const raw = await prisma.message.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: {
          OR: [{ sender_id: userId }, { recipient_id: userId }],
        },
        select: {
          id: true,
          conversation_id: true,
          sender_id: true,
          recipient_id: true,
          content: true,
          read: true,
          created_at: true,
        },
        orderBy: { created_at: 'asc' },
      });
      // Batch-lookup counterparties once.
      const counterpartyIds = new Set<string>();
      for (const m of raw) {
        if (m.sender_id && m.sender_id !== userId) counterpartyIds.add(m.sender_id);
        if (m.recipient_id && m.recipient_id !== userId) counterpartyIds.add(m.recipient_id);
      }
      const counterparties = counterpartyIds.size
        ? await prisma.user.findMany({
            take: EXPORT_ROW_LIMIT + 1,
            where: { id: { in: Array.from(counterpartyIds) } },
            select: { id: true, display_name: true, avatar_url: true },
          })
        : [];
      return {
        messages: raw.map(m => ({
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          recipient_id: m.recipient_id,
          direction: m.sender_id === userId ? 'sent' : 'received',
          content: m.content,
          read: m.read,
          created_at: m.created_at,
        })),
        counterparties,
      };
    },
  },
  {
    filename: 'group_chat_memberships.json',
    extract: async userId =>
      prisma.groupChatMember.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: { chat_id: true, joined_at: true },
      }),
  },
  {
    filename: 'group_chat_messages.json',
    extract: async userId =>
      prisma.groupChatMessage.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { sender_id: userId },
        select: {
          id: true,
          chat_id: true,
          content: true,
          created_at: true,
        },
      }),
  },
  {
    filename: 'events_created.json',
    extract: async userId =>
      prisma.event.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { creator_id: userId },
        select: {
          id: true,
          title: true,
          description: true,
          date: true,
          team_id: true,
          game_id: true,
          status: true,
          created_at: true,
        },
      }),
  },
  {
    filename: 'event_rsvps.json',
    extract: async userId =>
      prisma.eventRsvp.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: { event_id: true, created_at: true },
      }),
  },
  {
    filename: 'stories.json',
    extract: async userId =>
      // Stories present at export time. Most expire after 24h so typical
      // exports will have 0-3 here.
      prisma.story.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: {
          id: true,
          game_id: true,
          media_url: true,
          caption: true,
          created_at: true,
          expires_at: true,
        },
      }),
  },
  {
    filename: 'ads.json',
    extract: async userId =>
      prisma.ad.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: {
          id: true,
          business_name: true,
          banner_url: true,
          target_zip_code: true,
          contact_email: true,
          contact_name: true,
          status: true,
          payment_status: true,
          created_at: true,
          updated_at: true,
        },
      }),
  },
  {
    filename: 'reports_submitted.json',
    extract: async userId =>
      prisma.abuseReport.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { reporter_id: userId },
        select: {
          id: true,
          subject: true,
          message: true,
          status: true,
          created_at: true,
        },
      }),
  },
  {
    filename: 'notifications_received.json',
    extract: async userId =>
      // Received notifications. Actor id is included (the actor is a public
      // on-platform identity), but not the actor's email/DOB/auth data.
      prisma.notification.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: {
          id: true,
          type: true,
          actor_id: true,
          post_id: true,
          comment_id: true,
          message_id: true,
          created_at: true,
          read_at: true,
        },
      }),
  },
  {
    filename: 'parental_consent_history.json',
    extract: async userId =>
      // Consent transitions only. Internal reasons and admin identity are excluded.
      prisma.parentalConsentAudit.findMany({
        take: EXPORT_ROW_LIMIT + 1,
        where: { user_id: userId },
        select: {
          id: true,
          from_state: true,
          to_state: true,
          created_at: true,
        },
      }),
  },
];

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Build the ZIP archive of a user's data. Returns a Buffer containing the
 * complete ZIP and its manifest. Any extraction failure aborts the build;
 * callers must never advertise a partial archive as ready.
 */
export async function buildUserDataExportArchive(userId: string): Promise<{
  zipBuffer: Buffer;
  sizeBytes: number;
  domainsIncluded: string[];
  domainsFailed: string[];
}> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve());
    archive.on('error', reject);
  });

  let uncompressedBytes = 0;
  const domainsIncluded: string[] = [];
  const domainsFailed: string[] = [];
  const errors: Record<string, string> = {};

  for (const domain of DOMAINS) {
    try {
      const payload = await domain.extract(userId);
      assertWithinRowLimit(payload);
      const json = JSON.stringify(payload, null, 2);
      uncompressedBytes += Buffer.byteLength(json);
      if (uncompressedBytes > 32 * 1024 * 1024) throw new Error('export_size_limit');
      archive.append(json, { name: domain.filename });
      domainsIncluded.push(domain.filename);
    } catch (err) {
      domainsFailed.push(domain.filename);
      // Category only — never raw stack in the archive, it could leak
      // internal schema/path details.
      errors[domain.filename] =
        err instanceof Error && err.message === 'export_size_limit'
          ? 'export_size_limit'
          : 'extract_failed';
    }
  }

  if (domainsFailed.length) {
    archive.abort();
    throw new Error(`Data export incomplete: ${domainsFailed.join(', ')}`);
  }

  // Always emit a manifest so users can tell at a glance what the archive
  // contains and whether any domains failed.
  const manifest = {
    user_id: userId,
    generated_at: new Date().toISOString(),
    format_version: 1,
    domains_included: domainsIncluded,
    domains_failed: domainsFailed,
    errors,
    readme:
      'This archive contains the data VarsityHub holds that you directly own or authored. ' +
      "Secrets, OAuth identifiers, raw payment processor internals, and other users' " +
      'private contact information are intentionally excluded.',
  };
  archive.append(JSON.stringify(manifest, null, 2), { name: 'MANIFEST.json' });

  await archive.finalize();
  await done;

  const zipBuffer = Buffer.concat(chunks);
  return {
    zipBuffer,
    sizeBytes: zipBuffer.byteLength,
    domainsIncluded,
    domainsFailed,
  };
}

/**
 * Test-only: expose the domain list so unit tests can assert coverage
 * without hitting the DB.
 */
export function __getDataExportDomainsForTests() {
  return DOMAINS.map(d => d.filename);
}

// ─── Load-time registry / source-of-truth consistency check ──────────────────
// Fail loudly at import time if the extractors list drifts from the canonical
// domain name list. This catches mismatches in dev long before they'd be
// caught by the coverage test.
(() => {
  const registered = new Set(DOMAINS.map(d => d.filename));
  const expected = new Set<string>(DATA_EXPORT_DOMAIN_FILENAMES);
  for (const name of expected) {
    if (!registered.has(name)) {
      throw new Error(`[data-export] Builder is missing expected domain extractor: ${name}`);
    }
  }
  for (const name of registered) {
    if (!expected.has(name)) {
      throw new Error(
        `[data-export] Builder has unknown domain extractor (not in domainNames.ts): ${name}`
      );
    }
  }
})();
