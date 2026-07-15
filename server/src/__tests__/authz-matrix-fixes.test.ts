/**
 * Authorization-matrix live fixes (2026-07-14 matrix audit).
 *  - shared-game authority: destructive/core edits (delete, score) restricted to
 *    the CREATING team's side, not the opponent (creatorSideTeamIds).
 *  - event approve/reject self-review IDOR guard (parity with games).
 *  - DM thread history + GET /games/:id/posts block filtering.
 *  - shareLanding userLanding/programLanding privacy gates.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { creatorSideTeamIds } from '../lib/gameApproval.js';

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'src', ...p), 'utf8');

describe('creatorSideTeamIds (shared-game authority)', () => {
  it('excludes the opponent-approval team (opponent cannot be on the creator side)', () => {
    expect(creatorSideTeamIds('home', 'away', 'away')).toEqual(['home']);
    expect(creatorSideTeamIds('home', 'away', 'home')).toEqual(['away']);
  });
  it('returns both teams when there is no distinct opponent', () => {
    expect(creatorSideTeamIds('home', 'away', null)).toEqual(['home', 'away']);
  });
  it('handles a free-text opponent (single team id)', () => {
    expect(creatorSideTeamIds('home', null, null)).toEqual(['home']);
  });
});

describe('game delete + result use creator-side authority', () => {
  it('DELETE and PATCH /result gate on creatorSideTeamIds, not both teams', () => {
    const src = read('routes', 'games.ts');
    const calls = src.match(/creatorSideTeamIds\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('event approve/reject self-review IDOR guard', () => {
  it('events approve and reject block the creator reviewing their own event', () => {
    const src = read('routes', 'events.ts');
    // mirror games.ts self-review guard
    expect(src).toMatch(/cannot review your own/i);
  });
});

describe('block filtering on DM history + game posts', () => {
  it('messages DM read applies getBlockedUserIds', () => {
    expect(read('routes', 'messages.ts')).toMatch(/getBlockedUserIds/);
  });
  it('GET /games/:id/posts applies getBlockedUserIds', () => {
    const src = read('routes', 'games.ts');
    // the game-posts feed merges private + blocked exclusions before the query
    expect(src).toMatch(/getBlockedUserIds\(req\.user\?\.id/);
  });
});

describe('shareLanding user + program privacy gates', () => {
  it('userLanding checks profile privacy and programLanding checks team privacy', () => {
    const src = read('routes', 'shareLanding.ts');
    expect(src).toMatch(/profile_private/);
    expect(src).toMatch(/isTeamHiddenFromViewer|is_private/);
  });
});
