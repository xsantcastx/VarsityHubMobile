import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { trim } from 'react-native-video-trim';

interface VideoTrimmerProps {
  uri: string;
  onTrimComplete: (trimmedUri: string) => void;
  onTrimReset: () => void;
}

const THUMB_COUNT = 10;
const FILMSTRIP_HEIGHT = 50;
const HANDLE_WIDTH = 16;
const MIN_TRIM_SECONDS = 1;
const SCREEN_PADDING = 32; // 16px each side

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoTrimmer({ uri, onTrimComplete, onTrimReset }: VideoTrimmerProps) {
  const [duration, setDuration] = useState(0);
  const [thumbnails, setThumbnails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trimming, setTrimming] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [startLabel, setStartLabel] = useState('0:00');
  const [endLabel, setEndLabel] = useState('0:00');

  const trackWidth = Dimensions.get('window').width - SCREEN_PADDING - HANDLE_WIDTH * 2;

  const leftX = useSharedValue(0);
  const rightX = useSharedValue(trackWidth);
  const leftCtx = useSharedValue(0);
  const rightCtx = useSharedValue(trackWidth);
  const durationRef = useRef(0);

  // Prepare URI for ffmpeg (handle ph:// iOS PhotoKit URIs)
  const [processableUri, setProcessableUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === 'ios' && uri.startsWith('ph://')) {
        // Copy from PhotoKit to a temp file
        const dest = `${FileSystem.cacheDirectory}trim_input_${Date.now()}.mp4`;
        try {
          await FileSystem.copyAsync({ from: uri, to: dest });
          if (!cancelled) setProcessableUri(dest);
        } catch (e) {
          if (__DEV__) console.warn('[VideoTrimmer] Failed to copy ph:// URI:', e);
          if (!cancelled) setProcessableUri(uri);
        }
      } else {
        setProcessableUri(uri);
      }
    })();
    return () => { cancelled = true; };
  }, [uri]);

  // Create a player to read duration and generate thumbnails
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
  });

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && player.duration > 0 && thumbnails.length === 0) {
      const dur = player.duration;
      setDuration(dur);
      durationRef.current = dur;
      rightX.value = trackWidth;
      setEndLabel(formatTime(dur));

      const times = Array.from({ length: THUMB_COUNT }, (_, i) =>
        THUMB_COUNT > 1 ? (i / (THUMB_COUNT - 1)) * dur : 0
      );

      player
        .generateThumbnailsAsync(times, { maxHeight: FILMSTRIP_HEIGHT })
        .then((thumbs) => {
          setThumbnails(thumbs);
          setLoading(false);
        })
        .catch((e) => {
          if (__DEV__) console.warn('[VideoTrimmer] Thumbnail generation failed:', e);
          setLoading(false);
        });
    }
  });

  const updateLabels = useCallback(
    (lx: number, rx: number) => {
      if (durationRef.current <= 0) return;
      const start = (lx / trackWidth) * durationRef.current;
      const end = (rx / trackWidth) * durationRef.current;
      setStartLabel(formatTime(Math.max(0, start)));
      setEndLabel(formatTime(Math.min(durationRef.current, end)));
    },
    [trackWidth],
  );

  const markMoved = useCallback(() => setHasMoved(true), []);

  // Minimum gap in pixels
  const minGapPx = useMemo(() => {
    if (duration <= 0) return 20;
    return (MIN_TRIM_SECONDS / duration) * trackWidth;
  }, [duration, trackWidth]);

  // Left handle gesture
  const leftGesture = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .onStart(() => {
      leftCtx.value = leftX.value;
    })
    .onUpdate((e) => {
      const raw = leftCtx.value + e.translationX;
      const clamped = Math.max(0, Math.min(raw, rightX.value - minGapPx));
      leftX.value = clamped;
      runOnJS(updateLabels)(clamped, rightX.value);
      runOnJS(markMoved)();
    });

  // Right handle gesture
  const rightGesture = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .onStart(() => {
      rightCtx.value = rightX.value;
    })
    .onUpdate((e) => {
      const raw = rightCtx.value + e.translationX;
      const clamped = Math.min(trackWidth, Math.max(raw, leftX.value + minGapPx));
      rightX.value = clamped;
      runOnJS(updateLabels)(leftX.value, clamped);
      runOnJS(markMoved)();
    });

  // Animated styles
  const leftDimStyle = useAnimatedStyle(() => ({
    width: leftX.value,
  }));

  const rightDimStyle = useAnimatedStyle(() => ({
    width: trackWidth - rightX.value,
  }));

  const selectedStyle = useAnimatedStyle(() => ({
    left: leftX.value,
    width: rightX.value - leftX.value,
  }));

  const leftHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftX.value - HANDLE_WIDTH }],
  }));

  const rightHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rightX.value }],
  }));

  const handleReset = useCallback(() => {
    leftX.value = 0;
    rightX.value = trackWidth;
    setHasMoved(false);
    setStartLabel('0:00');
    setEndLabel(formatTime(durationRef.current));
    onTrimReset();
  }, [leftX, rightX, trackWidth, onTrimReset]);

  const handleTrim = useCallback(async () => {
    if (!processableUri || duration <= 0) return;
    setTrimming(true);

    const startSec = (leftX.value / trackWidth) * duration;
    const endSec = (rightX.value / trackWidth) * duration;
    // react-native-video-trim expects milliseconds
    const startMs = Math.round(startSec * 1000);
    const endMs = Math.round(endSec * 1000);

    try {
      const result = await trim(processableUri, {
        startTime: startMs,
        endTime: endMs,
      });

      if (result.success && result.outputPath) {
        onTrimComplete(result.outputPath);
      } else {
        if (__DEV__) console.warn('[VideoTrimmer] Trim failed:', result);
      }
    } catch (e) {
      if (__DEV__) console.warn('[VideoTrimmer] Trim error:', e);
    } finally {
      setTrimming(false);
    }
  }, [processableUri, duration, leftX, rightX, trackWidth, onTrimComplete]);

  const clipDuration = useMemo(() => {
    if (duration <= 0) return 0;
    const startSec = (leftX.value / trackWidth) * duration;
    const endSec = (rightX.value / trackWidth) * duration;
    return Math.max(0, endSec - startSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, startLabel, endLabel, trackWidth]);

  const thumbWidth = trackWidth / THUMB_COUNT;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trim Video</Text>
        {hasMoved && (
          <Pressable onPress={handleReset}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        )}
      </View>

      {/* Filmstrip */}
      <View style={[styles.filmstripContainer, { width: trackWidth + HANDLE_WIDTH * 2 }]}>
        {/* Left handle */}
        <GestureDetector gesture={leftGesture}>
          <Animated.View style={[styles.handle, styles.leftHandle, leftHandleStyle]}>
            <View style={styles.handleBar} />
          </Animated.View>
        </GestureDetector>

        {/* Filmstrip track */}
        <View style={[styles.filmstrip, { width: trackWidth, marginLeft: HANDLE_WIDTH }]}>
          {loading ? (
            <View style={styles.loadingRow}>
              {Array.from({ length: THUMB_COUNT }).map((_, i) => (
                <View key={i} style={[styles.thumbPlaceholder, { width: thumbWidth }]}>
                  {i === Math.floor(THUMB_COUNT / 2) && (
                    <ActivityIndicator size="small" color="#999" />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.thumbRow}>
              {thumbnails.map((thumb, i) => (
                <Image
                  key={i}
                  source={thumb}
                  style={[styles.thumb, { width: thumbWidth }]}
                  contentFit="cover"
                />
              ))}
            </View>
          )}

          {/* Dim overlays */}
          <Animated.View style={[styles.dimOverlay, styles.dimLeft, leftDimStyle]} />
          <Animated.View style={[styles.dimOverlay, styles.dimRight, rightDimStyle]} />

          {/* Selected region border */}
          <Animated.View style={[styles.selectedBorder, selectedStyle]} />
        </View>

        {/* Right handle */}
        <GestureDetector gesture={rightGesture}>
          <Animated.View style={[styles.handle, styles.rightHandle, rightHandleStyle]}>
            <View style={styles.handleBar} />
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Time labels */}
      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>{startLabel}</Text>
        <Text style={styles.durationLabel}>Duration: {formatTime(clipDuration)}</Text>
        <Text style={styles.timeLabel}>{endLabel}</Text>
      </View>

      {/* Apply Trim button */}
      {hasMoved && (
        <Pressable
          style={[styles.trimButton, trimming && styles.trimButtonDisabled]}
          onPress={handleTrim}
          disabled={trimming}
        >
          {trimming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.trimButtonText}>✂ Apply Trim</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resetText: {
    color: '#4A90D9',
    fontSize: 14,
  },
  filmstripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    height: FILMSTRIP_HEIGHT,
  },
  filmstrip: {
    height: FILMSTRIP_HEIGHT,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
  },
  loadingRow: {
    flexDirection: 'row',
    height: FILMSTRIP_HEIGHT,
  },
  thumbPlaceholder: {
    height: FILMSTRIP_HEIGHT,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbRow: {
    flexDirection: 'row',
    height: FILMSTRIP_HEIGHT,
  },
  thumb: {
    height: FILMSTRIP_HEIGHT,
  },
  dimOverlay: {
    position: 'absolute',
    top: 0,
    height: FILMSTRIP_HEIGHT,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dimLeft: {
    left: 0,
  },
  dimRight: {
    right: 0,
  },
  selectedBorder: {
    position: 'absolute',
    top: 0,
    height: FILMSTRIP_HEIGHT,
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 4,
  },
  handle: {
    width: HANDLE_WIDTH,
    height: FILMSTRIP_HEIGHT + 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 4,
    position: 'absolute',
    zIndex: 10,
  },
  leftHandle: {
    left: HANDLE_WIDTH,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  rightHandle: {
    left: HANDLE_WIDTH,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  handleBar: {
    width: 3,
    height: 20,
    backgroundColor: '#000',
    borderRadius: 1.5,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  timeLabel: {
    color: '#ccc',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  durationLabel: {
    color: '#999',
    fontSize: 12,
  },
  trimButton: {
    marginTop: 10,
    alignSelf: 'center',
    backgroundColor: '#4A90D9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  trimButtonDisabled: {
    opacity: 0.6,
  },
  trimButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
