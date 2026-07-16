import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Renders the first frame of a video as a static poster (paused, muted, no
 * controls). Thumbnail fallback for videos with no server-derived poster URL —
 * e.g. R2-hosted story videos, for which the Cloudinary-only getVideoPreviewUrl
 * returns null and the tile would otherwise be a blank black box.
 *
 * expo-video streams and paints frame 0 without downloading the whole file, and
 * is already in the app binary (used by VideoPlayer) — so this ships via OTA
 * with no new native module. pointerEvents="none" lets taps fall through to the
 * parent Pressable (opening the stories viewer).
 */
export function VideoFirstFrame({
  uri,
  style,
}: {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const source = React.useMemo(() => (uri ? { uri } : null), [uri]);
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

export default VideoFirstFrame;
