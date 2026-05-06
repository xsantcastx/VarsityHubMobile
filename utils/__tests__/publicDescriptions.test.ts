import { describe, expect, it } from '@jest/globals';
import { sanitizePublicDescription } from '@/utils/publicDescriptions';

describe('sanitizePublicDescription', () => {
  it('returns null for empty or placeholder descriptions', () => {
    expect(sanitizePublicDescription('')).toBeNull();
    expect(sanitizePublicDescription('   ')).toBeNull();
    expect(sanitizePublicDescription('Team Overview')).toBeNull();
    expect(sanitizePublicDescription('Welcome to the official team page for Westhill.')).toBeNull();
  });

  it('preserves real descriptions', () => {
    expect(sanitizePublicDescription('Competitive varsity basketball team in Stamford, CT.')).toBe(
      'Competitive varsity basketball team in Stamford, CT.'
    );
  });
});
