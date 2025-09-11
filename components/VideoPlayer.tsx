import React from 'react';
import { ViewStyle } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

export function VideoPlayer({ uri, style }: { uri: string; style?: ViewStyle }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      style={style as any}
      player={player}
      nativeControls
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

export default VideoPlayer;

