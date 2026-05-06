import { describe, expect, it } from '@jest/globals';
import { resolveMediaType, resolvePostMedia } from '../media';

describe('resolveMediaType', () => {
  it('returns null when there is no media url', () => {
    expect(resolveMediaType(null, 'video')).toBeNull();
    expect(resolveMediaType(undefined, 'image')).toBeNull();
  });

  it('trusts explicit media_type from the API', () => {
    expect(resolveMediaType('https://example.com/asset', 'video')).toBe('video');
    expect(resolveMediaType('https://example.com/asset', 'image')).toBe('image');
  });

  it('detects video urls with query params and hash fragments', () => {
    expect(resolveMediaType('https://cdn.example.com/clip.mp4?token=123#t=2', null)).toBe(
      'video',
    );
  });

  it('detects mkv videos that older client regexes missed', () => {
    expect(resolveMediaType('https://cdn.example.com/clip.mkv', null)).toBe('video');
  });
});

describe('resolvePostMedia', () => {
  it('uses preview_url for video thumbnails', () => {
    expect(
      resolvePostMedia({
        media_url: 'https://cdn.example.com/clip.mp4',
        media_type: 'video',
        preview_url: 'https://cdn.example.com/clip.jpg',
      }),
    ).toMatchObject({
      isVideo: true,
      displayImageUrl: 'https://cdn.example.com/clip.jpg',
    });
  });

  it('never tries to render the raw video url as an image when preview is missing', () => {
    expect(
      resolvePostMedia({
        media_url: 'https://cdn.example.com/clip.mp4?token=123',
        media_type: 'video',
      }),
    ).toMatchObject({
      isVideo: true,
      displayImageUrl: null,
    });
  });
});
