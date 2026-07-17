import { describe, expect, it } from '@jest/globals';

import { COMPRESS_PROGRESS_SHARE, mediaUploadLabel, mediaUploadPercent } from '../uploadProgress';

describe('mediaUploadPercent', () => {
  it('is indeterminate while preparing — the picker export has no signal to report', () => {
    expect(mediaUploadPercent('preparing', 0)).toBeNull();
    // Even if a caller passes a number, "preparing" must never render one.
    expect(mediaUploadPercent('preparing', 55)).toBeNull();
  });

  it('maps the compression pass onto the first slice of the bar', () => {
    expect(mediaUploadPercent('compressing', 0)).toBe(0);
    expect(mediaUploadPercent('compressing', 50)).toBe(20);
    expect(mediaUploadPercent('compressing', 100)).toBe(40);
  });

  it('maps the upload onto the remainder, starting where compression ended', () => {
    expect(mediaUploadPercent('uploading', 0)).toBe(40);
    expect(mediaUploadPercent('uploading', 50)).toBe(70);
    expect(mediaUploadPercent('uploading', 100)).toBe(100);
  });

  it('finalizing is a full bar', () => {
    expect(mediaUploadPercent('finalizing', 0)).toBe(100);
  });

  it('never moves backwards across the phase handoff', () => {
    // The whole point of one bar: the last compression reading must be <= the
    // first upload reading, or the user watches it snap back to zero.
    expect(mediaUploadPercent('compressing', 100)!).toBeLessThanOrEqual(
      mediaUploadPercent('uploading', 0)!
    );
    const sequence = [
      mediaUploadPercent('compressing', 0)!,
      mediaUploadPercent('compressing', 60)!,
      mediaUploadPercent('compressing', 100)!,
      mediaUploadPercent('uploading', 0)!,
      mediaUploadPercent('uploading', 40)!,
      mediaUploadPercent('uploading', 100)!,
      mediaUploadPercent('finalizing', 0)!,
    ];
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]).toBeGreaterThanOrEqual(sequence[i - 1]);
    }
  });

  it('hands the whole bar to the upload when there is no compression phase (images)', () => {
    expect(mediaUploadPercent('uploading', 0, 0)).toBe(0);
    expect(mediaUploadPercent('uploading', 50, 0)).toBe(50);
    expect(mediaUploadPercent('uploading', 100, 0)).toBe(100);
  });

  it('clamps out-of-range and non-finite inputs instead of overflowing the bar', () => {
    expect(mediaUploadPercent('uploading', 140)).toBe(100);
    expect(mediaUploadPercent('compressing', -20)).toBe(0);
    expect(mediaUploadPercent('uploading', Number.NaN)).toBe(40);
    expect(mediaUploadPercent('compressing', 50, 5)).toBe(50);
    expect(mediaUploadPercent('compressing', 50, -1)).toBe(0);
  });

  it('keeps the documented compression share', () => {
    expect(COMPRESS_PROGRESS_SHARE).toBe(0.4);
  });
});

describe('mediaUploadLabel', () => {
  it('says what is happening, and quotes the overall number so bar and text agree', () => {
    expect(mediaUploadLabel('preparing', 0)).toBe('Preparing video…');
    expect(mediaUploadLabel('compressing', 50)).toBe('Compressing video… 20%');
    expect(mediaUploadLabel('uploading', 50)).toBe('Uploading… 70%');
    expect(mediaUploadLabel('finalizing', 0)).toBe('Finishing up…');
  });

  it('shows no percentage for the indeterminate phase', () => {
    expect(mediaUploadLabel('preparing', 42)).not.toMatch(/%/);
  });
});
