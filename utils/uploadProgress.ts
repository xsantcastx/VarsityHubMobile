/**
 * One coherent progression for the media pipeline.
 *
 * Posting a video runs three distinct pieces of work back to back, and each one
 * used to be invisible or reported its own unrelated number:
 *
 *   1. `preparing`   — the picker's own AVAssetExportSession transcode plus our
 *                      iCloud materialize + size read. NO progress signal exists
 *                      for this: expo-image-picker's iOS `transcodeVideoAsync`
 *                      does a bare `await exportSession.export()` and emits
 *                      nothing, and the JS promise doesn't resolve until it is
 *                      done. This phase is honestly indeterminate — hence
 *                      `null`. Never invent a percentage here.
 *   2. `compressing` — react-native-compressor, real 0..1 native progress.
 *   3. `uploading`   — real byte progress from the R2 upload task / Cloudinary XHR.
 *   4. `finalizing`  — the POST that creates the row; short and unmeasured.
 *
 * `mediaUploadPercent` stitches the two REAL signals into a single bar that only
 * ever moves forward. The split between them is a fixed weight, not a measured
 * one — that is the only estimate here, and it is bounded: the bar can't jump or
 * rewind, it just moves at two different rates. Everything else is a real
 * reading or an explicit `null`.
 */

export type MediaUploadPhase = 'preparing' | 'compressing' | 'uploading' | 'finalizing';

/**
 * Fraction of the combined bar owned by the compression pass.
 *
 * Compression is roughly fixed-cost (~14s for a 90s 1080p clip) while upload
 * time swings from seconds on good wifi to minutes on congested stadium wifi,
 * so upload gets the larger share of the bar.
 */
export const COMPRESS_PROGRESS_SHARE = 0.4;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function clampShare(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Overall 0..100 for the combined bar, or `null` when the phase has no signal
 * and the caller must render an indeterminate spinner instead.
 *
 * `compressShare` is 0 for images (they have no compression phase of their own
 * that we can observe), which hands the whole bar to the upload.
 */
export function mediaUploadPercent(
  phase: MediaUploadPhase,
  phasePercent: number,
  compressShare: number = COMPRESS_PROGRESS_SHARE
): number | null {
  if (phase === 'preparing') return null;
  if (phase === 'finalizing') return 100;
  const share = clampShare(compressShare);
  const pct = clampPercent(phasePercent);
  if (phase === 'compressing') return Math.round(pct * share);
  return Math.round(share * 100 + pct * (1 - share));
}

/**
 * The user-facing line under the bar. Percentages shown are the OVERALL number
 * so the label and the bar always agree.
 */
export function mediaUploadLabel(
  phase: MediaUploadPhase,
  phasePercent: number,
  compressShare: number = COMPRESS_PROGRESS_SHARE
): string {
  if (phase === 'preparing') return 'Preparing video…';
  if (phase === 'finalizing') return 'Finishing up…';
  const overall = mediaUploadPercent(phase, phasePercent, compressShare);
  if (phase === 'compressing') return `Compressing video… ${overall}%`;
  return `Uploading… ${overall}%`;
}
