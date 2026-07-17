import { useEventListener } from 'expo';
import { Image } from 'expo-image';
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
  /**
   * REQUIRED — there is deliberately no default.
   *
   * Autoplay here always means autoplay WITH SOUND: `ensurePlaybackAudioSession`
   * puts the process in the `playback` category (`playsInSilentMode`, `duckOthers`)
   * permanently, and there is no mute toggle (owner decision 2026-07-16).
   *
   * That is the right behaviour on CONSUMPTION surfaces — feed, post detail,
   * stories, highlights, media lightboxes — where a fan is watching content and
   * "videos should always play right away" with sound.
   *
   * It is the WRONG behaviour on COMPOSER/PREVIEW surfaces — the create-post
   * preview, the story/video trimmers, team-contacts — where the user is
   * authoring, not watching. Blasting audio through the hardware silent switch
   * because someone picked a clip to post is not the owner's rule; pass `false`.
   *
   * Both defaults were footguns in opposite directions (a default of `true`
   * silently opted composer surfaces in; a default of `false` would silently
   * reintroduce the "video sitting at 0:00" bug on a consumption surface), and
   * the call sites split evenly 4/4 — so neither default is the narrow one.
   * Making it required moves the decision to the type checker: a new surface
   * cannot compile without stating which kind it is.
   */
  autoPlay: boolean;
  nativeControls?: boolean;
  paused?: boolean;
  contentFit?: VideoContentFit;
  /**
   * Still image shown while the video buffers, so a consumption surface shows
   * the first frame instead of a bare spinner over an empty box. Remote video
   * on a congested network can take seconds to produce its first frame; the
   * poster is already a cached image by then on any surface that rendered the
   * tile. Optional — without it the spinner-only behaviour is unchanged.
   */
  poster?: string | null;
}

export function VideoPlayer({
  uri,
  style,
  onEnd,
  autoPlay,
  nativeControls = true,
  paused,
  contentFit = 'contain',
  poster,
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

  // Read the LATEST playback intent from inside the focus effect without
  // putting these props in its dep array — a dep change re-runs the effect,
  // and its cleanup pauses, so `paused` churn would stutter playback.
  const autoPlayRef = React.useRef(autoPlay);
  autoPlayRef.current = autoPlay;
  const pausedRef = React.useRef(paused);
  pausedRef.current = paused;

  // Now that audio is always on and routed through the `playback` category, a
  // video left playing on a backgrounded screen keeps talking over whatever the
  // user opened next. Pause on blur, and resume on refocus — otherwise tapping
  // into a profile and coming back leaves the clip frozen mid-play, which is
  // the "video sitting at 0:00" complaint all over again. Neither the play
  // effect above nor the props change on refocus, so the resume has to happen
  // here.
  useFocusEffect(
    React.useCallback(() => {
      // Resume ONLY if this player is still meant to be playing. `paused` is
      // how every caller says "not my turn": the post-detail hero sets it
      // unless it's the active pager page with the fullscreen modal closed,
      // and stories/GVFS set it for every non-active item. Honouring it is
      // what keeps two videos from playing at once — a worse bug than the
      // freeze this fixes.
      if (autoPlayRef.current && !pausedRef.current) {
        try {
          player?.play();
        } catch (e) {
          // Non-critical: player may not be ready yet
          if (__DEV__) console.warn('[VideoPlayer] Resume on focus failed:', e);
        }
      }
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
      {/* Poster sits above the video surface only while it buffers, then
          unmounts so it can never cover playback. */}
      {poster && uri && isLoading && !errorMessage ? (
        <Image
          source={{ uri: poster }}
          style={styles.videoSurface}
          contentFit={contentFit === 'contain' ? 'contain' : 'cover'}
          transition={0}
          cachePolicy="memory-disk"
          pointerEvents="none"
        />
      ) : null}
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
