/**
 * Audit follow-up fixes (LOW authz + fan + migrations). 2026-07-15.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatEventTime } from '../lib/formatEventTime.js';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const src = (f: string) => read('src', 'routes', f);

describe('reports coverage + guards', () => {
  const r = src('reports.ts');
  it('group_chat_message is reportable + membership-gated', () => {
    expect(r).toMatch(/'group_chat_message'/);
    expect(r).toMatch(/groupChatMessage\.findUnique/);
    expect(r).toMatch(/group chats you belong to/);
  });
  it('team report has a self-guard and route requires verification', () => {
    expect(r).toMatch(/You cannot report your own team/);
    expect(r).toMatch(/requireVerified/);
  });
});

describe('group-chats /read checks membership', () => {
  it('returns 403 when updateMany affects 0 rows', () => {
    expect(src('group-chats.ts')).toMatch(/updated\.count === 0/);
  });
});

describe('org resend-approval uses the scoped owner helper', () => {
  it('no longer compares the raw league_owner_id pointer', () => {
    const o = src('organizations.ts');
    const idx = o.indexOf("'/:id/resend-approval-email'");
    const region = o.slice(idx, idx + 1200);
    expect(region).toMatch(/isOrganizationOwnerScoped\(userId, orgId\)/);
  });
});

describe('bookmark + poll race handling', () => {
  const p = src('posts.ts');
  it('bookmark create tolerates P2002 (idempotent)', () => {
    expect(p).toMatch(/if \(e\?\.code !== 'P2002'\) throw e/);
  });
  it('poll vote runs under Serializable', () => {
    const idx = p.indexOf('one vote per poll');
    const region = idx >= 0 ? p.slice(idx - 400, idx + 1200) : p;
    expect(region).toMatch(/isolationLevel: 'Serializable'/);
  });
});

describe('profile posts include per-viewer interaction flags', () => {
  it('users.ts loads viewer upvotes/bookmarks for the returned posts', () => {
    const u = src('users.ts');
    expect(u).toMatch(/has_upvoted: upSet\.has/);
    expect(u).toMatch(/has_bookmarked: bmSet\.has/);
  });
});

describe('timezone data pipeline', () => {
  it('Game + Event schema have a timezone column', () => {
    const schema = read('prisma', 'schema.prisma');
    expect((schema.match(/timezone\s+String\?/g) || []).length).toBeGreaterThanOrEqual(2);
  });
  it('game + event create accept and store timezone', () => {
    expect(src('games.ts')).toMatch(/timezone: parsed\.data\.timezone/);
    expect(src('events.ts')).toMatch(/timezone: data\.timezone/);
  });
});

describe('formatEventTime (behavioral)', () => {
  it('renders in the given IANA zone', () => {
    // 2026-09-01T23:00:00Z is 7:00 PM in America/New_York (EDT)
    const { timeStr } = formatEventTime('2026-09-01T23:00:00.000Z', 'America/New_York');
    expect(timeStr).toMatch(/7:00/);
  });
  it('falls back gracefully with no zone', () => {
    const { combined } = formatEventTime('2026-09-01T23:00:00.000Z', null);
    expect(combined).toMatch(/at /);
  });
  it('handles null date', () => {
    expect(formatEventTime(null).combined).toBe('TBD');
  });
});

describe('IAP ad-refund terminal state', () => {
  const a = read('src', 'lib', 'approvalService.ts');
  it('detects Apple IAP and routes to manual_refund_review', () => {
    expect(a).toMatch(/apple_iap_manual_review/);
    expect(a).toMatch(/payment_status: 'manual_refund_review'/);
  });
});

describe('promo redeem no longer mutates promo state', () => {
  const p = read('src', 'routes', 'promos.ts');
  it('redeem route uses previewPromo (validate-only), not redeemPromo', () => {
    const idx = p.indexOf("'/redeem'");
    const region = p.slice(idx, idx + 1600);
    expect(region).toMatch(/await previewPromo\(/);
    expect(region).not.toMatch(/await redeemPromo\(/);
    // redeemPromo is no longer imported into this route at all
    expect(p).not.toMatch(/import \{[^}]*redeemPromo/);
  });
});

describe('reminder reschedule on date change', () => {
  it('helper exists and both edit paths call it', () => {
    expect(read('src', 'lib', 'notifications.ts')).toMatch(
      /export async function rescheduleGameRemindersForEvent/
    );
    expect(read('src', 'routes', 'events.ts')).toMatch(/rescheduleGameRemindersForEvent/);
    expect(read('src', 'routes', 'games.ts')).toMatch(/rescheduleGameRemindersForEvent/);
  });
});

describe('google order_id replay migration exists', () => {
  it('a partial unique index migration is present', () => {
    const mig = read(
      'prisma',
      'migrations',
      '20260715000000_google_order_id_partial_unique',
      'migration.sql'
    );
    expect(mig).toMatch(/CREATE UNIQUE INDEX/);
    expect(mig).toMatch(/google_purchase:%/);
  });
});
