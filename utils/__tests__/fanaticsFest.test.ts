/**
 * Fanatics Fest NYC 2026 feed-pin helpers (owner ask, 2026-07-17).
 *
 * Venue / coords mirror the real prod fest data (Javits Center, 40.75687,
 * -74.001762) already pinned by __tests__/live-window.test.ts.
 */

import { NYC_METRO_RADIUS_KM, isFanaticsFestGame, isNycViewer, isNycZip } from '../fanaticsFest';

describe('isFanaticsFestGame', () => {
  it('matches all four day titles regardless of casing/whitespace', () => {
    expect(isFanaticsFestGame({ title: 'Fanatics Fest NYC 2026 — Day 1: Thursday, July 16' })).toBe(
      true
    );
    expect(isFanaticsFestGame({ title: 'Fanatics Fest NYC 2026 — Day 4: Sunday, July 19' })).toBe(
      true
    );
    expect(isFanaticsFestGame({ title: '  fanatics fest nyc 2026 — day 2  ' })).toBe(true);
  });

  it('does not match other games or missing titles', () => {
    expect(isFanaticsFestGame({ title: 'New York Liberty vs Minnesota Lynx' })).toBe(false);
    expect(isFanaticsFestGame({ title: 'MLB All-Star Game' })).toBe(false);
    expect(isFanaticsFestGame({ title: '' })).toBe(false);
    expect(isFanaticsFestGame({})).toBe(false);
    expect(isFanaticsFestGame(null)).toBe(false);
    expect(isFanaticsFestGame(undefined)).toBe(false);
  });
});

describe('isNycZip', () => {
  it('accepts the five-borough prefixes', () => {
    expect(isNycZip('10001')).toBe(true); // Manhattan
    expect(isNycZip('11201')).toBe(true); // Brooklyn
    expect(isNycZip('11375')).toBe(true); // Queens
    expect(isNycZip('10301')).toBe(true); // Staten Island
    expect(isNycZip('10451')).toBe(true); // Bronx
    expect(isNycZip('  11101 ')).toBe(true);
  });

  it('rejects non-NYC and malformed zips', () => {
    expect(isNycZip('07030')).toBe(false); // Hoboken NJ — covered by GPS radius, not zip
    expect(isNycZip('90210')).toBe(false); // Beverly Hills
    expect(isNycZip('10')).toBe(false);
    expect(isNycZip('')).toBe(false);
    expect(isNycZip(null)).toBe(false);
    expect(isNycZip(undefined)).toBe(false);
  });
});

describe('isNycViewer', () => {
  it('pins from a saved NYC zip even without device location', () => {
    expect(isNycViewer(null, '10001')).toBe(true);
    expect(isNycViewer(undefined, '11201')).toBe(true);
  });

  it('pins from device location anywhere in the metro radius', () => {
    expect(isNycViewer({ latitude: 40.75687, longitude: -74.001762 })).toBe(true); // Javits
    expect(isNycViewer({ latitude: 40.6782, longitude: -73.9442 })).toBe(true); // Brooklyn
    expect(isNycViewer({ latitude: 40.7357, longitude: -74.1724 })).toBe(true); // Newark ~15km
  });

  it('does not pin for a far-away viewer with no NYC zip', () => {
    expect(isNycViewer({ latitude: 34.0522, longitude: -118.2437 })).toBe(false); // LA
    expect(isNycViewer({ latitude: 34.0522, longitude: -118.2437 }, '90210')).toBe(false);
    expect(isNycViewer(null, null)).toBe(false);
    expect(isNycViewer({ latitude: null, longitude: null })).toBe(false);
  });

  it('has a metro-scale radius, not a strict at-venue one', () => {
    expect(NYC_METRO_RADIUS_KM).toBeGreaterThan(30);
  });
});
