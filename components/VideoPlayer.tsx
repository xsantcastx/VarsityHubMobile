import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

interface VideoPlayerProps {
  uri: string;
  style?: StyleProp<ViewStyle>;
  onEnd?: () => void;
  autoPlay?: boolean;
  nativeControls?: boolean;
  paused?: boolean;
}

export function VideoPlayer({
  uri,
  style,
  onEnd,
  autoPlay,
  nativeControls = true,
  paused,
}: VideoPlayerProps) {
  const player = useVideoPlayer(uri, (p) => {
    if (autoPlay && !paused) {
      try { p.play(); } catch {}
    }
  });

  useEventListener(player, 'playToEnd', () => {
    if (onEnd) onEnd();
  });

  // Control playback based on paused prop
  React.useEffect(() => {
    if (!player) return;
    try {
      if (paused) {
        player.pause();
      } else if (autoPlay) {
        player.play();
      }
    } catch {}
  }, [paused, player, autoPlay]);

  // Restart video when autoPlay changes from false to true
  React.useEffect(() => {
    if (!player || !autoPlay || paused) return;
    try {
      player.replay();
    } catch {}
  }, [autoPlay, player, paused]);

  return (
    <VideoView
      style={style}
      player={player}
      nativeControls={nativeControls}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

export default VideoPlayer;
