/**
 * Opponent-consent public-visibility invariants (2026-07-15 approval audit).
 *
 * A coach can create a game naming a real opponent team they don't manage — the
 * game is moderation-`approved` but `opponent_approval_status` is `pending`
 * until the opponent's staff consent (or `declined` if they refuse). Such an
 * UPCOMING fixture must NOT be publicly attributed to the non-consenting team on
 * any public surface. A PAST approved game stays public regardless (owner rule).
 *
 * Part 1 unit-tests the shared rule (isGamePubliclyVisible). Part 2 pins that
 * every public surface actually gates through it (source-shape invariants, so
 * they hold regardless of local test-DB migration drift).
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isGamePubliclyVisible } from '../lib/gameApproval.js';

const PAST = new Date(Date.now() - 86_400_000);
const FUTURE = new Date(Date.now() + 86_400_000);

describe('isGamePubliclyVisible — the canonical public rule', () => {
  it('hides a non-approved game outright', () => {
    expect(
      isGamePubliclyVisible({
        approval_status: 'pending',
        opponent_approval_status: 'approved',
        date: FUTURE,
      })
    ).toBe(false);
    expect(
      isGamePubliclyVisible({
        approval_status: 'rejected',
        opponent_approval_status: 'not_required',
        date: PAST,
      })
    ).toBe(false);
  });

  it('shows an approved game whose opponent is not_required or approved', () => {
    expect(
      isGamePubliclyVisible({
        approval_status: 'approved',
        opponent_approval_status: 'not_required',
        date: FUTURE,
      })
    ).toBe(true);
    expect(
      isGamePubliclyVisible({
        approval_status: 'approved',
        opponent_approval_status: 'approved',
        date: FUTURE,
      })
    ).toBe(true);
  });

  it('HIDES an approved UPCOMING game whose opponent is pending or declined', () => {
    expect(
      isGamePubliclyVisible({
        approval_status: 'approved',
        opponent_approval_status: 'pending',
        date: FUTURE,
      })
    ).toBe(false);
    expect(
      isGamePubliclyVisible({
        approval_status: 'approved',
        opponent_approval_status: 'declined',
        date: FUTURE,
      })
    ).toBe(false);
  });

  it('keeps an approved PAST game public even if opponent is pending/declined (owner rule)', () => {
    expect(
      isGamePubliclyVisible({
        approval_status: 'approved',
        opponent_approval_status: 'pending',
        date: PAST,
      })
    ).toBe(true);
    expect(
      isGamePubliclyVisible({
        approval_status: 'approved',
        opponent_approval_status: 'declined',
        date: PAST,
      })
    ).toBe(true);
  });

  it('treats a dateless approved game with a blocking opponent as not-yet-public', () => {
    expect(
      isGamePubliclyVisible({
        approval_status: 'approved',
        opponent_approval_status: 'pending',
        date: null,
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Every public surface must gate through the shared rule, not approval_status
// alone. Source-shape invariants (same idiom as ad-state-invariants).
// ---------------------------------------------------------------------------
const SRC = join(process.cwd(), 'src');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');

describe('public surfaces gate opponent-pending/declined games', () => {
  it.each(['og.ts', 'shareLanding.ts'])('%s uses shared game and event visibility', file => {
    const source = read('routes', file);
    expect(source).toContain('await canViewGameRecord(game)');
    expect(source).toContain('await canViewEventRecord(event)');
  });

  it('game media and detail delegate approval plus team privacy to the shared policy', () => {
    const games = read('routes', 'games.ts');
    expect(games).toContain('await canViewGameRecord(game as GameVisibilityRecord');
    const policy = read('lib', 'entityVisibility.ts');
    expect(policy).toContain('isGamePubliclyVisible(record)');
    expect(policy).toContain('isGamePubliclyVisible(record.game)');
    expect(policy).toContain('await teamsVisible(ids, viewerId)');
  });

  it('GET /events list and event search exclude opponent-blocked upcoming games', () => {
    const events = read('routes', 'events.ts');
    const search = read('routes', 'search.ts');
    // Both express the same "no game OR opponent-not-blocking OR past" clause.
    expect(events).toMatch(
      /opponent_approval_status:\s*\{\s*notIn:\s*\['pending',\s*'declined'\]\s*\}/
    );
    expect(events).toMatch(/\{\s*game_id:\s*null\s*\}/);
    expect(search).toMatch(
      /opponent_approval_status:\s*\{\s*notIn:\s*\['pending',\s*'declined'\]\s*\}/
    );
    expect(search).toMatch(/\{\s*game_id:\s*null\s*\}/);
  });

  it('feed followed-games query filters to publicly-visible games', () => {
    const feed = read('routes', 'feed.ts');
    expect(feed).toMatch(/approval_status:\s*'approved'/);
    expect(feed).toMatch(
      /opponent_approval_status:\s*\{\s*notIn:\s*\['pending',\s*'declined'\]\s*\}/
    );
  });
});
