import * as FileSystem from 'expo-file-system/legacy';

import {
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEO_SIZE_MB,
  VIDEO_COMPRESSION_THRESHOLD_BYTES,
  VIDEO_COMPRESSION_THRESHOLD_MB,
} from '@/constants/video';
import { captureException } from '@/utils/sentry';

// Module-level dynamic require (OfflineBanner pattern): resolves at bundle
// time, never crashes binaries that predate the native module.
let CompressorVideo: { compress: (uri: string, opts: object) => Promise<string> } | null = null;
try {
  CompressorVideo = require('react-native-compressor').Video;
} catch {
  CompressorVideo = null;
}

// Report the missing module once per session, not per call — old binaries
// would otherwise spam Sentry on every upload.
let reportedModuleMissing = false;

/**
 * Safe video compression wrapper.
 *
 * Uses react-native-compressor when the native module is available (i.e. in a
 * build that includes it).  Falls back to the original URI so the app never
 * crashes on binaries that predate the module — but both failure modes
 * (module missing vs. compression crashed mid-way) are reported to Sentry so
 * they are distinguishable and visible instead of silently swallowed.
 *
 * iOS also benefits from ImagePicker's videoExportPreset at the picker level,
 * so even without the compressor the file is transcoded by the OS.
 */
export async function compressVideoSafe(uri: string): Promise<string> {
  if (!CompressorVideo) {
    if (!reportedModuleMissing) {
      reportedModuleMissing = true;
      captureException(new Error('react-native-compressor native module unavailable'), {
        tags: { context: 'video_compress', stage: 'module_missing' },
      });
    }
    return uri;
  }
  try {
    const compressed: string = await CompressorVideo.compress(uri, {
      compressionMethod: 'auto', // picks the best available codec
      minimumFileSizeForCompress: 1, // compress any video (value is in MB)
    });
    return compressed ?? uri;
  } catch (e) {
    // Compression failed mid-way — fall back to the original, but make the
    // failure visible (an empty catch here hid a 3-month compression outage).
    captureException(e instanceof Error ? e : new Error(String(e)), {
      tags: { context: 'video_compress', stage: 'compress_failed' },
    });
    return uri;
  }
}

export async function getVideoFileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true } as any);
    if (info && info.exists && typeof (info as any).size === 'number') {
      return (info as any).size;
    }
  } catch {
    // Ignore size lookup failures — upload prep remains best-effort.
  }
  return 0;
}

type PrepareVideoForUploadOptions = {
  compressionThresholdBytes?: number;
};

/**
 * Prepare the final video asset right before upload.
 *
 * We deliberately compress at the upload boundary, not at pick time:
 * - trims should operate on the currently selected asset without extra passes
 * - stories/posts should compress once, not multiple times across screens
 * - small clips skip unnecessary CPU work and battery drain
 */
export async function prepareVideoForUpload(
  uri: string,
  options: PrepareVideoForUploadOptions = {}
): Promise<{
  uri: string;
  originalSizeBytes: number;
  finalSizeBytes: number;
  wasCompressed: boolean;
}> {
  const thresholdBytes = options.compressionThresholdBytes ?? VIDEO_COMPRESSION_THRESHOLD_BYTES;
  const originalSizeBytes = await getVideoFileSize(uri);

  if (originalSizeBytes > 0 && originalSizeBytes < thresholdBytes) {
    return {
      uri,
      originalSizeBytes,
      finalSizeBytes: originalSizeBytes,
      wasCompressed: false,
    };
  }

  const compressedUri = await compressVideoSafe(uri);
  let finalUri = compressedUri;
  let finalSizeBytes =
    compressedUri !== uri ? await getVideoFileSize(compressedUri) : originalSizeBytes;

  // Re-encoding already-compressed input can produce a LARGER file. Never
  // upload a worse asset than the one we started with.
  if (
    compressedUri !== uri &&
    originalSizeBytes > 0 &&
    finalSizeBytes > 0 &&
    finalSizeBytes >= originalSizeBytes
  ) {
    finalUri = uri;
    finalSizeBytes = originalSizeBytes;
  }

  // The pick-time 150MB gate ran on the ORIGINAL file. Re-validate the asset
  // we are actually about to upload. "too large" in the message routes this
  // through uploadErrorAlert's isSize branch.
  if (finalSizeBytes > MAX_VIDEO_SIZE_BYTES) {
    const err: any = new Error(
      `Video is too large after processing (${Math.round(finalSizeBytes / (1024 * 1024))}MB) — the limit is ${MAX_VIDEO_SIZE_MB}MB. Trim it shorter and try again.`
    );
    err.code = 'VIDEO_TOO_LARGE';
    throw err;
  }

  return {
    uri: finalUri,
    originalSizeBytes,
    finalSizeBytes,
    wasCompressed: finalUri !== uri,
  };
}

/**
 * Size-aware upload timeout: 6s per MB (≈1.4 Mbps sustained), floored at the
 * historical 5-minute default and capped at 15 minutes. A fixed 5-minute
 * timeout made 150MB uploads mathematically impossible on slow cellular.
 */
export function uploadTimeoutMsForSize(sizeBytes: number): number {
  if (!sizeBytes || sizeBytes <= 0) return 300_000;
  const scaled = Math.round(sizeBytes / (1024 * 1024)) * 6_000;
  return Math.min(900_000, Math.max(300_000, scaled));
}

export { VIDEO_COMPRESSION_THRESHOLD_MB };
