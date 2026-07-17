/**
 * Unit tests for mediaUtils (detectMediaType, getVideoPreviewUrl, resolvePreviewUrl)
 */
import { describe, expect, it } from '@jest/globals';
import { detectMediaType, getVideoPreviewUrl, resolvePreviewUrl } from '../lib/mediaUtils.js';

describe('detectMediaType', () => {
  it('returns image for null/undefined', () => {
    expect(detectMediaType(null)).toBe('image');
    expect(detectMediaType(undefined)).toBe('image');
  });

  it('returns video for video extensions', () => {
    expect(detectMediaType('https://example.com/video.mp4')).toBe('video');
    expect(detectMediaType('file.mov')).toBe('video');
    expect(detectMediaType('file.webm')).toBe('video');
    expect(detectMediaType('file.m4v')).toBe('video');
    expect(detectMediaType('file.avi')).toBe('video');
    expect(detectMediaType('file.mkv')).toBe('video');
  });

  it('returns image for non-video extensions', () => {
    expect(detectMediaType('https://example.com/photo.jpg')).toBe('image');
    expect(detectMediaType('photo.png')).toBe('image');
    expect(detectMediaType('photo.webp')).toBe('image');
  });

  it('ignores query params and hash', () => {
    expect(detectMediaType('https://example.com/video.mp4?token=abc#t=10')).toBe('video');
    expect(detectMediaType('photo.jpg?size=large')).toBe('image');
  });

  it('is case insensitive', () => {
    expect(detectMediaType('video.MP4')).toBe('video');
    expect(detectMediaType('video.Mov')).toBe('video');
  });
});

describe('getVideoPreviewUrl', () => {
  it('returns null for non-video URLs', () => {
    expect(getVideoPreviewUrl('https://example.com/photo.jpg')).toBeNull();
    expect(getVideoPreviewUrl(null)).toBeNull();
  });

  it('returns null for non-Cloudinary video URLs (they use poster_url instead)', () => {
    expect(getVideoPreviewUrl('https://media.r2.example/clip.mp4')).toBeNull();
  });

  it('returns preview URL for Cloudinary video', () => {
    const url = 'https://res.cloudinary.com/demo/video/upload/v123/sample.mp4';
    const result = getVideoPreviewUrl(url);
    expect(result).toContain('f_webp');
    expect(result).toContain('fl_awebp');
    expect(result).toContain('du_3');
    expect(result).toContain('w_480');
    expect(result).toContain('res.cloudinary.com');
    expect(result).toContain('v123/sample.mp4');
  });
});

describe('resolvePreviewUrl', () => {
  // Real URL shapes from the Fanatics Fest Day 1 posts (prod, 2026-07-16).
  const R2 = 'https://pub-61f12b49067c403ca5f56fa57105b3ed.r2.dev/varsityhub/production';
  const r2Video = `${R2}/088eb9361b1bbb02e122e83137f87fbd.mp4`;
  const r2Poster = `${R2}/62e196e97955c7229a7702a27f4f1751.jpg`;

  it('uses the stored poster for an R2 video — R2 cannot synthesize one via URL transform', () => {
    // This is the whole bug: the Cloudinary derivation returns null here, so a
    // serializer calling it directly renders a black tile for real fest video.
    expect(getVideoPreviewUrl(r2Video)).toBeNull();
    expect(resolvePreviewUrl({ media_url: r2Video, poster_url: r2Poster })).toBe(r2Poster);
  });

  it('returns null for an R2 video with no stored poster (nothing to derive)', () => {
    expect(resolvePreviewUrl({ media_url: r2Video, poster_url: null })).toBeNull();
  });

  it('still derives a poster for legacy Cloudinary video with no poster_url', () => {
    const cloudinaryVideo = 'https://res.cloudinary.com/demo/video/upload/v123/sample.mp4';
    expect(resolvePreviewUrl({ media_url: cloudinaryVideo, poster_url: null })).toContain('f_webp');
  });

  it('prefers a stored poster over the Cloudinary derivation', () => {
    const cloudinaryVideo = 'https://res.cloudinary.com/demo/video/upload/v123/sample.mp4';
    expect(resolvePreviewUrl({ media_url: cloudinaryVideo, poster_url: r2Poster })).toBe(r2Poster);
  });

  it('returns null for an image post', () => {
    expect(
      resolvePreviewUrl({ media_url: `${R2}/fe117ac7ad072f6c.jpg`, poster_url: null })
    ).toBeNull();
  });
});
