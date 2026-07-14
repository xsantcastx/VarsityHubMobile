import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import { toUserMessage } from '@/utils/toUserMessage';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface VideoPlayerProps {
  uri?: string | null;
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
  const [retryKey, setRetryKey] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  // Callers pass mediaUrl! assertions; a missing uri must not crash the
  // player. Pass a null source (expo-video accepts it) and render the
  // error overlay below instead of skipping hooks with an early return.
  const source = React.useMemo(() => (uri ? { uri } : null), [uri]);
  const player = useVideoPlayer(source, p => {
    if (!uri) return;
    p.volume = 1.0;
    p.muted = false;
    if (autoPlay && !paused) {
      try {
        p.play();
      } catch (e) {
        // Video player may not be ready yet - non-critical
        if (__DEV__) console.warn('[VideoPlayer] Initial play failed:', e);
      }
    }
  });

  useEventListener(player, 'playToEnd', () => {
    if (onEnd) onEnd();
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'loading') {
      setIsLoading(true);
      setErrorMessage(null);
      return;
    }
    if (status === 'readyToPlay') {
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }
    if (status === 'error') {
      setIsLoading(false);
      setErrorMessage(toUserMessage(error, 'Video unavailable'));
    }
  });

  React.useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);
  }, [uri, retryKey]);

  // Control playback based on paused prop
  React.useEffect(() => {
    if (!player) return;
    try {
      if (paused) {
        player.pause();
      } else if (autoPlay) {
        player.play();
      }
    } catch (e) {
      // Video state change failed - non-critical
      if (__DEV__) console.warn('[VideoPlayer] Play/pause state change failed:', e);
    }
  }, [paused, player, autoPlay]);

  // Restart video when autoPlay changes from false to true
  React.useEffect(() => {
    if (!player || !autoPlay || paused) return;
    try {
      player.replay();
    } catch (e) {
      // Replay failed - non-critical
      if (__DEV__) console.warn('[VideoPlayer] Replay failed:', e);
    }
  }, [autoPlay, player, paused]);

  return (
    <View style={style}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls={nativeControls}
        allowsFullscreen
        allowsPictureInPicture
      />
      {!uri ? (
        <View style={styles.overlay}>
          <Text style={styles.errorTitle}>Video unavailable</Text>
        </View>
      ) : isLoading && !errorMessage ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      ) : null}
      {uri && errorMessage ? (
        <Pressable
          onPress={() => {
            setIsLoading(true);
            setErrorMessage(null);
            setRetryKey(prev => prev + 1);
          }}
          style={styles.overlay}
          accessibilityRole="button"
          accessibilityLabel="Retry video playback"
        >
          <Text style={styles.errorTitle}>Video unavailable</Text>
          <Text style={styles.errorCaption}>Tap to retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  errorCaption: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default VideoPlayer;
