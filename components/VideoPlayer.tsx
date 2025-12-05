import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import { ViewStyle } from 'react-native';

export function VideoPlayer({ uri, style, onEnd, autoPlay, nativeControls = true, paused }: { uri: string; style?: ViewStyle; onEnd?: () => void; autoPlay?: boolean; nativeControls?: boolean; paused?: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    if (autoPlay && !paused) {
      try { p.play(); } catch (_error) {}
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
    } catch (err) {
    }
  }, [paused, player, autoPlay]);

  // Restart video when autoPlay changes from false to true
  React.useEffect(() => {
    if (!player || !autoPlay || paused) return;
    try {
      player.replay();
    } catch (err) {
    }
  }, [autoPlay, player, paused]);

  return (
    <VideoView
      style={style as any}
      player={player}
      nativeControls={nativeControls}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

export default VideoPlayer;
