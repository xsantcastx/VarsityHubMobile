import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer, type VideoContentFit } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { toUserMessage } from '@/utils/toUserMessage';
import { ensurePlaybackAudioSession } from '@/utils/audioSession';
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
  contentFit?: VideoContentFit;
}

export function VideoPlayer({
  uri,
  style,
  onEnd,
  // Videos play RIGHT AWAY, not on tap (owner decision 2026-07-16). Defaulting
  // here rather than at each call site is deliberate: the post-detail hero was
  // the surface the owner filmed sitting at 0:00, and it simply never passed
  // the prop. Callers that must not autoplay gate with `paused`, not by
  // omitting this.
  autoPlay = true,
  nativeControls = true,
  paused,
  contentFit = 'contain',
}: VideoPlayerProps) {
  const [retryKey, setRetryKey] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  // Videos ALWAYS play with sound (owner decision 2026-07-16). The mute toggle
  // that used to float over the media was removed along with it. Setting
  // `muted = false` alone is not enough on iOS — see ensurePlaybackAudioSession.
  ensurePlaybackAudioSession();
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

  // Now that audio is always on and routed through the `playback` category, a
  // video left playing on a backgrounded screen keeps talking over whatever the
  // user opened next. Pause on blur; resume only if this player was autoplaying.
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        try {
          player?.pause();
        } catch (e) {
          // Non-critical: player may already be released
          if (__DEV__) console.warn('[VideoPlayer] Pause on blur failed:', e);
        }
      };
    }, [player])
  );

  return (
    <View style={style}>
      <VideoView
        // NOT absoluteFill: on web the RN style becomes left/right/top/bottom
        // CSS on the <video> element, and an absolutely-positioned REPLACED
        // element with auto width/height renders at its intrinsic video size
        // instead of stretching — the video overflowed its box and its native
        // controls floated over unrelated content. Explicit 100% sizes behave
        // identically on native and correctly on web.
        style={styles.videoSurface}
        player={player}
        nativeControls={nativeControls}
        contentFit={contentFit}
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
  videoSurface: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
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
