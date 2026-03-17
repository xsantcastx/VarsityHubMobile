/**
 * Unit tests for mediaUtils (detectMediaType, getVideoPreviewUrl)
 */
import { describe, expect, it } from '@jest/globals';
import { detectMediaType, getVideoPreviewUrl } from '../lib/mediaUtils.js';

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

  it('returns null for non-Cloudinary video URLs', () => {
    expect(getVideoPreviewUrl('https://example.com/video.mp4')).toBeNull();
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
