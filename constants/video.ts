import * as ImagePicker from 'expo-image-picker';

/**
 * Single source of truth for video capture/upload settings.
 *
 * Quality: 1080p (H264_1920x1080) across all capture surfaces. MediumQuality
 * (~540p) was the prior default and looked soft on highlight playback; the
 * 150MB upload cap below has ample headroom for 1080p at the 90s post cap.
 */
export const VIDEO_CAPTURE_PRESET = ImagePicker.VideoExportPreset.H264_1920x1080;

/** Image upload cap — shared by create-post and BannerUpload (was two independent 10MB literals). */
export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

/**
 * Duration caps (2026-07-13, highlights-first product decision): over-limit
 * picks are never rejected — the surface opens VideoTrimmer with the cap as
 * the max selectable window ("pick your best N seconds") and blocks submit
 * until a trim is applied.
 */
/** Feed posts: sports highlights, hard cap at 90 seconds. */
export const POST_MAX_DURATION_S = 90;
/** Stories are short-form: hard cap at 20 seconds. */
export const STORY_MAX_DURATION_S = 20;
/** Team-chat clips: same cap as posts today, but an independent knob. */
export const CHAT_VIDEO_MAX_DURATION_S = 90;

/**
 * Upload size cap. MUST equal the server-signed Cloudinary max_bytes in
 * server/src/routes/uploads.ts (enforced by
 * app/__tests__/video-upload-limits.contract.test.ts).
 */
export const MAX_VIDEO_SIZE_MB = 150;
export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024;

/**
 * Client-side compression threshold.
 *
 * Videos below this size are usually already small enough after the picker's
 * export preset and do not need another compression pass before upload.
 */
export const VIDEO_COMPRESSION_THRESHOLD_MB = 8;
export const VIDEO_COMPRESSION_THRESHOLD_BYTES = VIDEO_COMPRESSION_THRESHOLD_MB * 1024 * 1024;

export function isNativeVideoTrimSupported(platform: string): boolean {
  return platform === 'ios' || platform === 'android';
}
