import { resolveMediaFit } from '../mediaAspect';

describe('resolveMediaFit', () => {
  it('shows a landscape clip whole (contain) at its true aspect', () => {
    const fit = resolveMediaFit(1920, 1080);
    expect(fit.isLandscape).toBe(true);
    expect(fit.contentFit).toBe('contain');
    expect(fit.aspectRatio).toBeCloseTo(16 / 9);
  });

  it('fills the portrait frame (cover) for a portrait clip', () => {
    const fit = resolveMediaFit(1080, 1920);
    expect(fit.isLandscape).toBe(false);
    expect(fit.contentFit).toBe('cover');
    expect(fit.aspectRatio).toBeCloseTo(9 / 16);
  });

  it('treats a square clip as fill, not landscape (no needless bars)', () => {
    const fit = resolveMediaFit(1080, 1080);
    expect(fit.isLandscape).toBe(false);
    expect(fit.contentFit).toBe('cover');
  });

  it('falls back to cover when dimensions are unknown (old rows / R2 proxy)', () => {
    for (const [w, h] of [
      [null, null],
      [undefined, undefined],
      [0, 0],
      [1920, 0],
      [NaN, 1080],
    ] as [any, any][]) {
      const fit = resolveMediaFit(w, h);
      expect(fit.contentFit).toBe('cover');
      expect(fit.aspectRatio).toBeNull();
      expect(fit.isLandscape).toBe(false);
    }
  });
});
