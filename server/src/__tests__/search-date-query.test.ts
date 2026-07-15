import { describe, expect, it } from '@jest/globals';
import { parseDateQuery } from '../lib/searchDateQuery.js';

const NOW = new Date('2026-07-15T12:00:00Z');

function startISO(q: string): string | null {
  const w = parseDateQuery(q, NOW);
  return w ? w.start.toISOString() : null;
}

describe('parseDateQuery', () => {
  it('parses month-name formats', () => {
    expect(startISO('July 14 2026')).toBe('2026-07-14T00:00:00.000Z');
    expect(startISO('july 14, 2026')).toBe('2026-07-14T00:00:00.000Z');
    expect(startISO('Jul 14 2026')).toBe('2026-07-14T00:00:00.000Z');
    expect(startISO('july 14th 2026')).toBe('2026-07-14T00:00:00.000Z');
    expect(startISO('14 july 2026')).toBe('2026-07-14T00:00:00.000Z');
  });

  it('defaults a missing year to the current UTC year', () => {
    expect(startISO('july 14')).toBe('2026-07-14T00:00:00.000Z');
    expect(startISO('7/14')).toBe('2026-07-14T00:00:00.000Z');
  });

  it('parses numeric and ISO formats', () => {
    expect(startISO('7/14/26')).toBe('2026-07-14T00:00:00.000Z');
    expect(startISO('7/14/2026')).toBe('2026-07-14T00:00:00.000Z');
    expect(startISO('07-14-2026')).toBe('2026-07-14T00:00:00.000Z');
    expect(startISO('2026-07-14')).toBe('2026-07-14T00:00:00.000Z');
  });

  it('window extends 30h to cover US-evening games stored on the next UTC day', () => {
    const w = parseDateQuery('july 14 2026', NOW)!;
    expect(w.end.toISOString()).toBe('2026-07-15T06:00:00.000Z');
    // France vs Spain, 2026-07-14T19:00Z, must fall inside the window
    const kickoff = new Date('2026-07-14T19:00:00Z');
    expect(kickoff >= w.start && kickoff < w.end).toBe(true);
  });

  it('never treats plain numbers, zips, names, or free text as dates', () => {
    expect(parseDateQuery('10001', NOW)).toBeNull();
    expect(parseDateQuery('2026', NOW)).toBeNull();
    expect(parseDateQuery('fifa', NOW)).toBeNull();
    expect(parseDateQuery('france vs spain', NOW)).toBeNull();
    expect(parseDateQuery('varsity 14', NOW)).toBeNull();
    expect(parseDateQuery('', NOW)).toBeNull();
  });

  it('rejects impossible dates', () => {
    expect(parseDateQuery('feb 30 2026', NOW)).toBeNull();
    expect(parseDateQuery('13/45/2026', NOW)).toBeNull();
    expect(parseDateQuery('0/0/2026', NOW)).toBeNull();
  });
});
