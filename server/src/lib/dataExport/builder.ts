/**
 * GDPR / right-to-access data export ZIP builder.
 * audit-allow unbounded-file
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

// ─── Domain extractors ───────────────────────────────────────────────────────

const DOMAINS: DomainExtractor[] = [
  {
    filename: 'profile.json',
    extract: async userId => {
      const u = (await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          display_name: true,
          username: true,
          avatar_url: true,
          bio: true,
          location: true,
          header_image_url: true,
          theme_color: true,
          position: true,
          jersey_number: true,
          grade_level: true,
          graduation_year: true,
          accolades: true,
          primary_sport: true,
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
        } as any,
      })) as any;
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
      return u?.preferences ?? null;
    },
  },
  {
    filename: 'billing_summary.json',
    extract: async userId => {
      // Derived summary only — no raw Stripe objects. Source of truth is
      // User.subscription_* fields plus preferences.plan / apple_* metadata.
      const u = (await prisma.user.findUnique({
        where: { id: userId },
        select: {
          subscription_tier: true,
          subscription_status: true,
          max_teams: true,
          paid_by_owner: true,
          preferences: true,
        } as any,
      })) as any;
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
        where: { coach_id: userId } as any,
        select: {
          id: true, name: true, sport: true, created_at: true,
          city: true, state: true, country_code: true,
          organization_id: true, is_private: true,
        } as any,
      }),
  },
  {
    filename: 'team_memberships.json',
    extract: async userId =>
      prisma.teamMembership.findMany({
        where: { user_id: userId },
        select: {
          team_id: true, role: true, status: true,
          custom_position: true, joined_at: true,
        } as any,
      }),
  },
  {
    filename: 'team_follows.json',
    extract: async userId =>
      prisma.teamFollow.findMany({
        where: { user_id: userId },
        select: { team_id: true, created_at: true } as any,
      }),
  },
  {
    filename: 'organization_memberships.json',
    extract: async userId =>
      prisma.organizationMembership.findMany({
        where: { user_id: userId },
        select: { organization_id: true, role: true, status: true, joined_at: true } as any,
      }),
  },
  {
    filename: 'organization_follows.json',
    extract: async userId =>
      prisma.organizationFollow.findMany({
        where: { user_id: userId },
        select: { organization_id: true, created_at: true } as any,
      }),
  },
  {
    filename: 'organization_join_requests.json',
    extract: async userId =>
      prisma.organizationJoinRequest.findMany({
        where: { user_id: userId },
        select: {
          organization_id: true, status: true, message: true,
          created_at: true, reviewed_at: true,
        } as any,
      }),
  },
  {
    filename: 'posts.json',
    extract: async userId =>
      prisma.post.findMany({
        where: { author_id: userId },
        select: {
          id: true, content: true, media_url: true, created_at: true,
          team_id: true, deleted_at: true, upvotes_count: true,
        } as any,
      }),
  },
  {
    filename: 'comments.json',
    extract: async userId =>
      prisma.comment.findMany({
        where: { author_id: userId },
        select: {
          id: true, post_id: true, content: true, created_at: true,
          parent_comment_id: true,
        } as any,
      }),
  },
  {
    filename: 'post_upvotes.json',
    extract: async userId =>
      prisma.postUpvote.findMany({
        where: { user_id: userId },
        select: { post_id: true, created_at: true } as any,
      }),
  },
  {
    filename: 'post_bookmarks.json',
    extract: async userId =>
      prisma.postBookmark.findMany({
        where: { user_id: userId },
        select: { post_id: true, created_at: true } as any,
      }),
  },
  {
    filename: 'follows.json',
    extract: async userId => {
      const [following, followers] = await Promise.all([
        prisma.follows.findMany({
          where: { follower_id: userId },
          select: { following_id: true, created_at: true, status: true } as any,
        }),
        prisma.follows.findMany({
          where: { following_id: userId },
          select: { follower_id: true, created_at: true, status: true } as any,
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
        where: { blocker_id: userId },
        select: { blocked_id: true, created_at: true } as any,
      }),
  },
  {
    filename: 'messages.json',
    extract: async userId => {
      // Both directions — user's own sent + messages received. For each
      // message, we include minimal counterparty identity (user_id,
      // display_name, avatar_url) — NOT email, phone, DOB, or auth data.
      const raw = await prisma.message.findMany({
        where: {
          OR: [{ sender_id: userId }, { recipient_id: userId }],
        },
        select: {
          id: true, conversation_id: true, sender_id: true,
          recipient_id: true, content: true, read: true, created_at: true,
        },
        orderBy: { created_at: 'asc' },
        take: 50_000,
      });
      // Batch-lookup counterparties once.
      const counterpartyIds = new Set<string>();
      for (const m of raw) {
        if (m.sender_id && m.sender_id !== userId) counterpartyIds.add(m.sender_id);
        if (m.recipient_id && m.recipient_id !== userId) counterpartyIds.add(m.recipient_id);
      }
      const counterparties = counterpartyIds.size
        ? await prisma.user.findMany({
            where: { id: { in: Array.from(counterpartyIds) } },
            select: { id: true, display_name: true, avatar_url: true },
          })
        : [];
      return {
        messages: raw.map(m => ({
          id: m.id,
          conversation_id: m.conversation_id,
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
        where: { user_id: userId },
        select: { chat_id: true, joined_at: true, role: true } as any,
      }),
  },
  {
    filename: 'group_chat_messages.json',
    extract: async userId =>
      prisma.groupChatMessage.findMany({
        where: { sender_id: userId },
        select: {
          id: true, chat_id: true, content: true, created_at: true,
        } as any,
      }),
  },
  {
    filename: 'events_created.json',
    extract: async userId =>
      prisma.event.findMany({
        where: { creator_id: userId },
        select: {
          id: true, title: true, description: true, date: true,
          location: true, team_id: true, game_id: true, status: true,
          created_at: true,
        } as any,
      }),
  },
  {
    filename: 'event_rsvps.json',
    extract: async userId =>
      prisma.eventRsvp.findMany({
        where: { user_id: userId },
        select: { event_id: true, status: true, created_at: true } as any,
      }),
  },
  {
    filename: 'stories.json',
    extract: async userId =>
      // Stories present at export time. Most expire after 24h so typical
      // exports will have 0-3 here.
      prisma.story.findMany({
        where: { user_id: userId },
        select: {
          id: true, game_id: true, media_url: true, caption: true,
          created_at: true, expires_at: true,
        } as any,
      }),
  },
  {
    filename: 'ads.json',
    extract: async userId =>
      prisma.ad.findMany({
        where: { user_id: userId },
        select: {
          id: true, business_name: true, banner_url: true, target_zip_code: true,
          contact_email: true, contact_name: true, status: true,
          payment_status: true, created_at: true, updated_at: true,
        } as any,
      }),
  },
  {
    filename: 'reports_submitted.json',
    extract: async userId =>
      prisma.abuseReport.findMany({
        where: { reporter_id: userId },
        select: {
          id: true, subject: true, message: true, status: true, created_at: true,
        } as any,
      }),
  },
  {
    filename: 'notifications_received.json',
    extract: async userId =>
      // Received notifications. Actor id is included (the actor is a public
      // on-platform identity), but not the actor's email/DOB/auth data.
      prisma.notification.findMany({
        where: { user_id: userId },
        select: {
          id: true, type: true, actor_id: true, post_id: true,
          comment_id: true, message_id: true, meta: true,
          created_at: true, read_at: true,
        } as any,
        take: 10_000,
      }),
  },
  {
    filename: 'parental_consent_history.json',
    extract: async userId =>
      // Consent actions ON the requesting user's account. Admin identity
      // redacted — we expose actor_admin_id only (opaque), not email, since
      // the admin is not a party to this export.
      prisma.parentalConsentAudit.findMany({
        where: { user_id: userId } as any,
        select: {
          id: true, action: true, reason: true, actor_admin_id: true,
          created_at: true,
        } as any,
      }),
  },
];

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Build the ZIP archive of a user's data. Returns a Buffer containing the
 * full ZIP plus a manifest of which domains were included and any domains
 * that failed (the partial-failure path — a single bad extractor should not
 * kill the whole export; it gets recorded as an error entry in the ZIP).
 */
export async function buildUserDataExportArchive(
  userId: string
): Promise<{
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

  const domainsIncluded: string[] = [];
  const domainsFailed: string[] = [];
  const errors: Record<string, string> = {};

  for (const domain of DOMAINS) {
    try {
      const payload = await domain.extract(userId);
      const json = JSON.stringify(payload, null, 2);
      archive.append(json, { name: domain.filename });
      domainsIncluded.push(domain.filename);
    } catch (err) {
      domainsFailed.push(domain.filename);
      // Category only — never raw stack in the archive, it could leak
      // internal schema/path details.
      errors[domain.filename] = (err as any)?.code || 'extract_failed';
    }
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
      'Secrets, OAuth identifiers, raw payment processor internals, and other users\' ' +
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
      throw new Error(
        `[data-export] Builder is missing expected domain extractor: ${name}`
      );
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
