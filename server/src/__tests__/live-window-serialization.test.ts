/**
 * serializeLiveWindow — the server ships computed posting-window bounds so the
 * app stops re-deriving them.
 *
 * The app used to hardcode its own cutoffs, which let feed/maps/event pages
 * disagree. The server now serializes the canonical -2h/+4h standard window
 * and the coach-selected -2h/+12h all-day window.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { serializeLiveWindow } from '../lib/geofencing.js';

const FEST_DAY1_START = new Date('2026-07-16T17:00:00.000Z');

describe('serializeLiveWindow', () => {
  it('honors the 12h all-day event override', () => {
    expect(serializeLiveWindow(FEST_DAY1_START, 12)).toEqual({
      starts_at: '2026-07-16T17:00:00.000Z',
      live_from: '2026-07-16T15:00:00.000Z',
      live_until: '2026-07-17T05:00:00.000Z',
    });
  });

  it('falls back to the 4h default when no override is set', () => {
    expect(serializeLiveWindow(FEST_DAY1_START, null).live_until).toBe('2026-07-16T21:00:00.000Z');
    expect(serializeLiveWindow(FEST_DAY1_START, undefined).live_until).toBe(
      '2026-07-16T21:00:00.000Z'
    );
    // 0 / negative are not a real window — treat as unset, not as "closes at start".
    expect(serializeLiveWindow(FEST_DAY1_START, 0).live_until).toBe('2026-07-16T21:00:00.000Z');
  });

  it('accepts an ISO string as well as a Date', () => {
    expect(serializeLiveWindow('2026-07-16T17:00:00.000Z', 12)).toEqual(
      serializeLiveWindow(FEST_DAY1_START, 12)
    );
  });

  it('returns nulls for a missing or unparseable date rather than throwing', () => {
    const empty = { starts_at: null, live_from: null, live_until: null };
    expect(serializeLiveWindow(null, 12)).toEqual(empty);
    expect(serializeLiveWindow(undefined, 12)).toEqual(empty);
    expect(serializeLiveWindow('not-a-date', 12)).toEqual(empty);
  });
});

describe('GET /games ships the bounds', () => {
  const src = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');

  it('serializes the window from the EVENT, not the game row', () => {
    // The game row's own date can disagree with its event's (prod: fest Day 1
    // game says 03:39Z, its event says 17:00Z). The posting checks enforce
    // against the event, so the client must be told the same thing.
    expect(src).toMatch(/serializeLiveWindow\(\s*event\?\.date \?\? rest\.date,/);
    expect(src).toMatch(/event\?\.live_window_hours_after_start/);
  });

  it('spreads the window onto the payload', () => {
    expect(src).toMatch(/\.\.\.liveWindow,/);
  });
});

describe('live-window write authorization', () => {
  const eventsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'events.ts'), 'utf8');
  const gamesSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');

  it('rejects fan-created events that try to set a custom posting window', () => {
    expect(eventsSrc).toMatch(/data\.live_window_hours_after_start !== undefined && !autoApprove/);
    expect(eventsSrc).toMatch(/LIVE_WINDOW_STAFF_ONLY/);
  });

  it('requires team staff or admin to edit an event posting window', () => {
    expect(eventsSrc).toMatch(
      /data\.live_window_hours_after_start !== undefined && !canManageLinkedTeam && !isAdmin/
    );
  });

  it('requires staff or admin on single and bulk game creation', () => {
    expect(gamesSrc).toMatch(
      /parsed\.data\.live_window_hours_after_start !== undefined && !approvalDecision\.isCoach/
    );
    expect(gamesSrc).toMatch(
      /g\.live_window_hours_after_start !== undefined && !decisionByIndex\[i\]\.isCoach/
    );
  });

  it('requires staff or admin to edit a game posting window', () => {
    expect(gamesSrc).toMatch(
      /d\.live_window_hours_after_start !== undefined && !isCoach && !isAdmin/
    );
  });
});
