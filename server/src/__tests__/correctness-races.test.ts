/**
 * Phase 4: correctness + race conditions from the 2026-07-14 audit.
 *  4a RSVP rejects cancelled/pending events; game delete cancels linked events
 *  4c event PATCH syncs date/location/title back to the linked game
 *  4d DM conversation_id is always server-derived (no inbox spoofing)
 *  4e grace period honored before forcing 'free'
 *  4g sole-owner guards run under Serializable; DELETE owner-count is active-only
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'src', ...p), 'utf8');

describe('4a RSVP + game-delete event handling', () => {
  const events = read('routes', 'events.ts');
  const games = read('routes', 'games.ts');
  it('RSVP handler rejects non-approved / cancelled events', () => {
    const idx = events.lastIndexOf("'/:id/rsvp'");
    const region = events.slice(idx, idx + 1600);
    expect(region).toMatch(/approval_status/);
    expect(region).toMatch(/status === 'cancelled'/);
  });
  it('game delete cancels linked events instead of orphaning them', () => {
    expect(games).toMatch(/event\.updateMany\(\s*\{\s*where:\s*\{\s*game_id:\s*id\s*\}/);
  });
});

describe('4c event PATCH syncs date/location/title to linked game', () => {
  it('gameUpdate includes date/location/title', () => {
    const src = read('routes', 'events.ts');
    expect(src).toMatch(/gameUpdate\.date = new Date\(data\.date\)/);
    expect(src).toMatch(/gameUpdate\.location = /);
    expect(src).toMatch(/gameUpdate\.title = /);
  });
});

describe('4d DM conversation_id is server-derived', () => {
  it('does not trust a client conversation_id as the storage key', () => {
    const src = read('routes', 'messages.ts');
    expect(src).not.toMatch(/let convId = conversation_id/);
    expect(src).toMatch(/const convId = `dm:\$\{pair\[0\]\}__\$\{pair\[1\]\}`/);
  });
});

describe('4e grace period honored', () => {
  it('subscription.ts checks grace_period_expires_at before forcing free', () => {
    const src = read('middleware', 'subscription.ts');
    expect(src).toMatch(/grace_period_expires_at/);
  });
});

describe('4g owner-guard races', () => {
  it('team transfer-ownership runs under Serializable with a guarded demotion', () => {
    const src = read('routes', 'teams.ts');
    const idx = src.indexOf("'/:id/transfer-ownership'");
    const region = src.slice(idx, idx + 4000);
    expect(region).toMatch(/isolationLevel:\s*'Serializable'/);
    expect(region).toMatch(/OWNER_CHANGED/);
  });
  it('PATCH membership sole-owner count + update run under Serializable', () => {
    const src = read('routes', 'team-memberships.ts');
    expect(src).toMatch(/SOLE_OWNER_GUARD/);
  });
  it('DELETE membership owner-count is active-only', () => {
    const src = read('routes', 'team-memberships.ts');
    expect(src).toMatch(/role: 'owner', status: 'active' \},\s*\}\);\s*if \(ownerCount/);
  });
});
