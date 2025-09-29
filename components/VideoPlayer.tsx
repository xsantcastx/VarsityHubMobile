import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import { ViewStyle } from 'react-native';

export function VideoPlayer({ uri, style, onEnd, autoPlay, nativeControls = true, paused }: { uri: string; style?: ViewStyle; onEnd?: () => void; autoPlay?: boolean; nativeControls?: boolean; paused?: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    if (autoPlay) {
      try { p.play(); } catch {}
    }
  });

  useEventListener(player, 'playToEnd', () => {
    if (onEnd) onEnd();
  });

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
