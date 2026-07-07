import * as ImagePicker from 'expo-image-picker';

/**
 * Single source of truth for video capture/upload settings.
 *
 * Quality: MediumQuality across all capture surfaces (deliberate, consistent).
 * To move to 1080p later, change VIDEO_CAPTURE_PRESET to
 * ImagePicker.VideoExportPreset.H264_1920x1080 — nothing else.
 */
export const VIDEO_CAPTURE_PRESET = ImagePicker.VideoExportPreset.MediumQuality;

/** Stories are short-form: hard cap at 30 seconds. */
export const STORY_MAX_DURATION_S = 30;

/**
 * Upload size cap. MUST equal the server-signed Cloudinary max_bytes in
 * server/src/routes/uploads.ts (enforced by
 * app/__tests__/video-upload-limits.contract.test.ts).
 */
export const MAX_VIDEO_SIZE_MB = 150;
export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024;
