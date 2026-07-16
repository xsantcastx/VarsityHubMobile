import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

// Module-level cache so a story's generated poster is produced once per session,
// not on every re-render / scroll recycle.
const thumbnailCache = new Map<string, string>();

/**
 * Fallback poster for a video that has no server-derived thumbnail URL — e.g.
 * R2-hosted story videos, for which the Cloudinary-only getVideoPreviewUrl
 * returns null and the tile would otherwise be a blank black box.
 *
 * Primary: generate a real still image with expo-video-thumbnails (dynamically
 * imported so it degrades gracefully if absent from an older binary, and cached
 * per URL). This is the most reliable route — a plain image, no live player.
 * Fallback: if generation is unavailable or fails on this URL, stream the first
 * frame with a paused expo-video VideoView (already in the binary via
 * VideoPlayer). If both are unavailable, render nothing and let the parent's
 * dark tile + play icon show (no worse than before).
 */
function ExpoVideoPoster({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const source = React.useMemo(() => ({ uri }), [uri]);
  const player = useVideoPlayer(source, p => {
    try {
      p.muted = true;
      p.pause();
    } catch {
      /* player not ready yet — non-critical */
    }
  });
  return (
    <View style={style} pointerEvents="none">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls={false}
        contentFit="cover"
      />
    </View>
  );
}

export function VideoFirstFrame({
  uri,
  style,
}: {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [thumbUri, setThumbUri] = React.useState<string | null>(() =>
    uri ? (thumbnailCache.get(uri) ?? null) : null
  );
  const [thumbFailed, setThumbFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setThumbFailed(false);

    if (!uri) {
      setThumbUri(null);
      return;
    }
    const cached = thumbnailCache.get(uri);
    if (cached) {
      setThumbUri(cached);
      return;
    }
    setThumbUri(null);

    void (async () => {
      try {
        // Dynamic import: expo-video-thumbnails is a native module; a build that
        // predates it must not crash on require — fall back to the video frame.
        const VideoThumbnails = await import('expo-video-thumbnails');
        // time: 100ms — the exact frame 0 is often black on encoded clips.
        const result = await VideoThumbnails.getThumbnailAsync(uri, { time: 100, quality: 0.6 });
        if (cancelled) return;
        if (result?.uri) {
          thumbnailCache.set(uri, result.uri);
          setThumbUri(result.uri);
        } else {
          setThumbFailed(true);
        }
      } catch {
        if (!cancelled) setThumbFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (thumbUri) {
    return (
      <Image
        source={{ uri: thumbUri }}
        style={style as StyleProp<ImageStyle>}
        contentFit="cover"
        transition={200}
      />
    );
  }
  if (thumbFailed && uri) {
    return <ExpoVideoPoster uri={uri} style={style} />;
  }
  // Still generating (or no uri) — parent renders the dark tile + play icon.
  return null;
}

export default VideoFirstFrame;
