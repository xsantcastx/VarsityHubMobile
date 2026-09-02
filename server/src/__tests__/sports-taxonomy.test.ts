import { describe, expect, it } from '@jest/globals';
import {
  SPORT_SLUGS,
  isCanonicalSport,
  normalizeSportToSlug,
  getSportLabel,
} from '../lib/sportsTaxonomy.js';

describe('sports taxonomy', () => {
  it('exposes canonical slugs including the legacy create-team nine', () => {
    for (const slug of [
      'basketball',
      'football',
      'soccer',
      'baseball',
      'mma',
      'tennis',
      'volleyball',
      'swimming',
      'track_field',
      'other',
    ]) {
      expect(SPORT_SLUGS.has(slug)).toBe(true);
    }
  });

  it('validates slugs strictly', () => {
    expect(isCanonicalSport('soccer')).toBe(true);
    expect(isCanonicalSport('Soccer')).toBe(false);
    expect(isCanonicalSport('futbol')).toBe(false);
  });

  it('normalizes free-text sport values from the legacy Team.sport column', () => {
    expect(normalizeSportToSlug('Basketball')).toBe('basketball');
    expect(normalizeSportToSlug('  soccer ')).toBe('soccer');
    expect(normalizeSportToSlug('Track & Field')).toBe('track_field');
    expect(normalizeSportToSlug('track and field')).toBe('track_field');
    expect(normalizeSportToSlug('Track')).toBe('track_field');
    expect(normalizeSportToSlug('Swimming')).toBe('swimming');
    expect(normalizeSportToSlug('Swim & Dive')).toBe('swimming');
    expect(normalizeSportToSlug('XC')).toBe('cross_country');
    expect(normalizeSportToSlug('Hockey')).toBe('ice_hockey');
    expect(normalizeSportToSlug('Mixed Martial Arts')).toBe('mma');
    expect(normalizeSportToSlug('underwater basket weaving')).toBe(null);
    expect(normalizeSportToSlug(null)).toBe(null);
    expect(normalizeSportToSlug('')).toBe(null);
  });

  it('maps slugs to display labels', () => {
    expect(getSportLabel('track_field')).toBe('Track & Field');
    expect(getSportLabel('nope')).toBe('nope');
  });
});
