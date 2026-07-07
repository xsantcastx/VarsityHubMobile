import { describe, expect, it } from '@jest/globals';
import { optimizeImageUrl, optimizeVideoUrl } from '@/utils/imageUrl';

describe('imageUrl helpers', () => {
  it('adds image delivery transforms to Cloudinary URLs', () => {
    expect(
      optimizeImageUrl('https://res.cloudinary.com/demo/image/upload/v1/sample.jpg', 800)
    ).toBe('https://res.cloudinary.com/demo/image/upload/w_800,q_auto,f_auto/v1/sample.jpg');
  });

  it('adds q_auto-only video delivery transforms to Cloudinary URLs', () => {
    expect(optimizeVideoUrl('https://res.cloudinary.com/demo/video/upload/v1/sample.mp4')).toBe(
      'https://res.cloudinary.com/demo/video/upload/q_auto/v1/sample.mp4'
    );
  });

  it('leaves non-Cloudinary video URLs unchanged', () => {
    expect(optimizeVideoUrl('https://cdn.example.com/video.mp4')).toBe(
      'https://cdn.example.com/video.mp4'
    );
  });
});
