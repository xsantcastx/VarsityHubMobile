import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickBannerFromArrays } from '@/utils/gameDetailsPresentation';

const source = readFileSync(
  join(process.cwd(), 'app', 'game-details', 'GameDetailsScreen.tsx'),
  'utf8'
);

describe('GameDetailsScreen banner fallback contract', () => {
  it('never promotes attendee media into the event hero banner fallback', () => {
    expect(source).toContain('pickBannerFromArrays(vm ?? {})');
    expect(
      pickBannerFromArrays({
        bannerUrl: 'https://example.test/banner',
        coverImageUrl: 'https://example.test/cover',
      })
    ).toBe('https://example.test/banner');
    expect(pickBannerFromArrays({ coverImageUrl: 'https://example.test/cover' })).toBe(
      'https://example.test/cover'
    );
    expect(
      pickBannerFromArrays({ media: [{ url: 'https://example.test/private-post' }] } as any)
    ).toBeNull();
    expect(source).not.toContain('media[0]?.url');
  });
});
