/**
 * Video playback telemetry — the measurement foundation for "why is playback slow".
 *
 * Playback performance was previously invisible: there was no record of how long
 * a video took to show its first frame, how often it rebuffered, or how often it
 * failed — so "it's slow" could never be turned into a number or attributed to a
 * surface / host. This hook fills that gap by observing the expo-video status
 * stream that every consumption surface already subscribes to.
 *
 * Three signals are emitted through the existing PostHog `analytics` pipe (a
 * no-op in dev/tests, so this is safe everywhere):
 *   - `video_first_frame` — time-to-first-frame (TTFF): first `loading` → first
 *     `readyToPlay`, in ms. `cached: true` when the file was ready with no load
 *     wait. This is THE number that answers "does it play right away".
 *   - `video_rebuffer`   — the player fell back to `loading` after being ready
 *     (mid-playback stall).
 *   - `video_error`      — the source failed to open/play.
 *
 * Every event carries `surface` (feed / post_detail / stories / …) and `host`
 * (r2 / cloudinary / local / …) so slowness can be sliced by both — R2 vs
 * Cloudinary is exactly the split the delivery audit cares about.
 */
import { useCallback, useRef } from 'react';
import { analytics } from '@/utils/analytics';

export type VideoPlaybackStatus = 'idle' | 'loading' | 'readyToPlay' | 'error';

/** Classify the delivery host so playback metrics can be sliced by origin. */
export function classifyVideoHost(uri?: string | null): string {
  if (!uri) return 'none';
  if (uri.startsWith('file:')) return 'local';
  if (uri.startsWith('data:')) return 'data';
  const host = uri.split('/')[2] || '';
  if (!host) return uri.startsWith('/') ? 'relative' : 'unknown';
  if (host.includes('cloudinary')) return 'cloudinary';
  if (host.includes('r2.cloudflarestorage') || host.endsWith('r2.dev')) return 'r2';
  return host.toLowerCase();
}

/**
 * Returns a stable `report(status, errorMessage?)` callback to invoke from the
 * surface's existing `statusChange` listener. State is kept in refs and reset
 * whenever the `uri` changes, so one hook instance correctly measures a player
 * that swaps sources (the feed recycles players as you scroll).
 */
export function useVideoPlaybackTelemetry(surface: string, uri?: string | null) {
  const loadStartedAt = useRef<number | null>(null);
  const firstFrameReported = useRef(false);
  const hasBeenReady = useRef(false);
  const trackedUri = useRef<string | null | undefined>(uri);

  // Source swap → this is a new playback attempt; drop the previous timings.
  if (trackedUri.current !== uri) {
    trackedUri.current = uri;
    loadStartedAt.current = null;
    firstFrameReported.current = false;
    hasBeenReady.current = false;
  }

  return useCallback(
    (status: VideoPlaybackStatus, errorMessage?: string) => {
      const now = Date.now();
      const host = classifyVideoHost(uri);

      if (status === 'loading') {
        if (loadStartedAt.current == null) {
          // First load of this source — start the TTFF clock.
          loadStartedAt.current = now;
        } else if (hasBeenReady.current) {
          // Ready, then back to loading → a mid-playback stall.
          analytics.track('video_rebuffer', { surface, host });
        }
        return;
      }

      if (status === 'readyToPlay') {
        if (!firstFrameReported.current) {
          firstFrameReported.current = true;
          const cached = loadStartedAt.current == null;
          analytics.track('video_first_frame', {
            surface,
            host,
            cached,
            ttff_ms: cached ? 0 : now - (loadStartedAt.current as number),
          });
        }
        hasBeenReady.current = true;
        return;
      }

      if (status === 'error') {
        analytics.track('video_error', {
          surface,
          host,
          message: errorMessage ?? 'unknown',
        });
      }
    },
    [surface, uri]
  );
}
