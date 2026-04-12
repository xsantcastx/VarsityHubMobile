/**
 * Regression: Cloudinary delivery URLs must inject `fl_strip_profile` so images
 * served to users don't carry EXIF/GPS metadata from the original upload.
 */

import { describe, it, expect } from '@jest/globals';
import { stripImageMetadataUrl } from '../lib/cloudinary.js';

describe('stripImageMetadataUrl', () => {
  it('inserts fl_strip_profile after /upload/ for image URLs with just a version segment', () => {
    const input = 'https://res.cloudinary.com/demo/image/upload/v1234/sample.jpg';
    const out = stripImageMetadataUrl(input, 'image');
    expect(out).toBe('https://res.cloudinary.com/demo/image/upload/fl_strip_profile/v1234/sample.jpg');
  });

  it('prepends fl_strip_profile to an existing transformation block', () => {
    const input = 'https://res.cloudinary.com/demo/image/upload/w_500,h_500/v1234/sample.jpg';
    const out = stripImageMetadataUrl(input, 'image');
    expect(out).toBe('https://res.cloudinary.com/demo/image/upload/fl_strip_profile,w_500,h_500/v1234/sample.jpg');
  });

  it('is idempotent when fl_strip_profile is already present', () => {
    const input = 'https://res.cloudinary.com/demo/image/upload/fl_strip_profile,w_500/v1234/sample.jpg';
    const out = stripImageMetadataUrl(input, 'image');
    expect(out).toBe(input);
  });

  it('leaves video URLs alone (Cloudinary strips video metadata on its own)', () => {
    const input = 'https://res.cloudinary.com/demo/video/upload/v1234/sample.mp4';
    const out = stripImageMetadataUrl(input, 'video');
    expect(out).toBe(input);
  });

  it('returns undefined for undefined input', () => {
    expect(stripImageMetadataUrl(undefined, 'image')).toBeUndefined();
  });

  it('returns the URL unchanged if it does not match the expected Cloudinary shape', () => {
    const input = 'https://example.com/some/other/asset.jpg';
    expect(stripImageMetadataUrl(input, 'image')).toBe(input);
  });
});
