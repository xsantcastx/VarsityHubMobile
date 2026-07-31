import { customSportSlug } from '../lib/sportsTaxonomy.js';

describe('customSportSlug', () => {
  it('gives different custom sports different slugs', () => {
    expect(customSportSlug('Rowing')).toBe('custom:rowing');
    expect(customSportSlug('Fencing')).toBe('custom:fencing');
    expect(customSportSlug('Rowing')).not.toBe(customSportSlug('Fencing'));
  });
  it('normalizes case, whitespace, and punctuation stably', () => {
    expect(customSportSlug('  Rock Climbing  ')).toBe('custom:rock-climbing');
    expect(customSportSlug('rock climbing')).toBe('custom:rock-climbing');
  });
  it('falls back to "other" for blank/nullish names', () => {
    expect(customSportSlug('')).toBe('other');
    expect(customSportSlug('   ')).toBe('other');
    expect(customSportSlug(null)).toBe('other');
    expect(customSportSlug(undefined)).toBe('other');
  });
});
