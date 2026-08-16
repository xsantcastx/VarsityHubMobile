import { describe, it, expect } from '@jest/globals';
import { clampTakeoverMinutes, deriveTakeoverState } from '../lib/marketingTakeover.js';

describe('marketing takeover — duration clamp', () => {
  it('defaults to 60 for missing/NaN/zero/negative input', () => {
    expect(clampTakeoverMinutes(NaN)).toBe(60);
    expect(clampTakeoverMinutes(0)).toBe(60);
    expect(clampTakeoverMinutes(-5)).toBe(60);
  });

  it('passes through in-range values and floors fractions', () => {
    expect(clampTakeoverMinutes(30)).toBe(30);
    expect(clampTakeoverMinutes(1)).toBe(1);
    expect(clampTakeoverMinutes(59.9)).toBe(59);
  });

  it('caps at 180 minutes', () => {
    expect(clampTakeoverMinutes(180)).toBe(180);
    expect(clampTakeoverMinutes(181)).toBe(180);
    expect(clampTakeoverMinutes(100000)).toBe(180);
  });
});

describe('marketing takeover — state derivation', () => {
  it('is inactive when no timestamp is stored', () => {
    expect(deriveTakeoverState(null)).toEqual({ active: false, until: null });
    expect(deriveTakeoverState(undefined)).toEqual({ active: false, until: null });
  });

  it('is active for a future timestamp and echoes it back', () => {
    const until = new Date(Date.now() + 30 * 60_000).toISOString();
    expect(deriveTakeoverState(until)).toEqual({ active: true, until });
  });

  it('is inactive (nulls the timestamp) once the window has passed', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(deriveTakeoverState(past)).toEqual({ active: false, until: null });
  });
});
