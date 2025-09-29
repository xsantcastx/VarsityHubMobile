import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { resolveMatchBannerPalette, type MatchBannerPalette, type ResolvePaletteInput } from '../utils/resolveMatchBannerPalette';

type Props = {
  input: ResolvePaletteInput;
  reduceMotion?: boolean;
  variant?: 'full' | 'compact';
  // When true, the overlay will reduce its background/streak opacity to avoid covering
  // underlying images (useful when the banner is a hero with real team logos).
  suppressBackground?: boolean;
  // When true, completely disable all decorative overlay layers (use for a clean hero image)
  suppressAllOverlays?: boolean;
};

const usePalette = (input: ResolvePaletteInput): MatchBannerPalette => {
  return useMemo(() => resolveMatchBannerPalette(input), [input]);
};

const addOpacity = (color: string, alpha: number) => {
  if (color.startsWith('rgba')) return color;
  return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
};

export default function MatchBannerOverlayLayer({ input, reduceMotion = false, variant = 'full', suppressBackground = false, suppressAllOverlays = false }: Props) {
  const palette = usePalette(input);
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      sweepAnim.stopAnimation();
      glowAnim.stopAnimation();
      sweepAnim.setValue(0.5);
      glowAnim.setValue(palette.motion.glowIntensity);
      return;
    }

    const sweep = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: palette.motion.sweepDuration,
        useNativeDriver: true,
      }),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: palette.motion.glowIntensity,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: palette.motion.glowIntensity * 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    sweep.start();
    glow.start();
    return () => {
      sweep.stop();
      glow.stop();
    };
  }, [glowAnim, palette.motion.glowIntensity, palette.motion.sweepDuration, reduceMotion, sweepAnim]);

  const sweepTranslate = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] });
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.1] });

  if (suppressAllOverlays) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <LinearGradient
        colors={palette.backgroundGradient}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={[styles.backgroundWash, suppressBackground ? { opacity: 0.12 } : null]}
      />

      <Animated.View style={[styles.streakContainer, { transform: [{ translateX: sweepTranslate }], opacity: suppressBackground ? 0.12 : 1 }] }>
          <LinearGradient
            colors={palette.streakGradient.colors as any}
            locations={palette.streakGradient.locations as any}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.streakGradient}
          />
      </Animated.View>

      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: addOpacity(palette.rimGlow, 0.32),
            opacity: reduceMotion ? palette.motion.glowIntensity : glowAnim,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      <View style={[styles.glass, { backgroundColor: palette.glassTint }]} />

      {variant !== 'compact' ? (
        <View style={styles.particlesLayer}>
          {/* Decorative left/right streaks for hero banners (low opacity so logos show through) */}
          {suppressBackground ? (
            <>
              <Animated.View style={[styles.sideStreakLeft, { backgroundColor: addOpacity(palette.accent, 0.28) }]} />
              <Animated.View style={[styles.sideStreakRight, { backgroundColor: addOpacity(palette.accent, 0.28) }]} />
              <Animated.View style={[styles.centerFlare, { backgroundColor: addOpacity(palette.accent, 0.45), opacity: 0.9, transform: [{ scale: glowScale }] }]} />
            </>
          ) : (
            <>
              <View style={[styles.particle, { backgroundColor: addOpacity(palette.accent, 0.4), top: '18%', left: '12%' }]} />
              <View style={[styles.particle, { backgroundColor: addOpacity(palette.accent, 0.25), top: '32%', right: '8%', width: 6, height: 6 }]} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundWash: {
    ...StyleSheet.absoluteFillObject,
  },
  streakContainer: {
    position: 'absolute',
    left: '-25%',
    top: '-15%',
    width: '150%',
    height: '130%',
    transform: [{ rotate: '-15deg' }],
    opacity: 0.85,
  },
  streakGradient: {
    width: '100%',
    height: '100%',
  },
  glow: {
    position: 'absolute',
    left: '45%',
    top: '50%',
    width: 220,
    height: 220,
    borderRadius: 120,
    opacity: 0.5,
  },
  glass: {
    ...StyleSheet.absoluteFillObject,
  },
  particlesLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 10,
    shadowColor: '#ffffff',
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  sideStreakLeft: {
    position: 'absolute',
    left: '-10%',
    top: '20%',
    width: '60%',
    height: 10,
    borderRadius: 6,
    transform: [{ rotate: '-2deg' }],
    opacity: 0.9,
    zIndex: 20,
  },
  sideStreakRight: {
    position: 'absolute',
    right: '-10%',
    top: '20%',
    width: '60%',
    height: 10,
    borderRadius: 6,
    transform: [{ rotate: '2deg' }],
    opacity: 0.9,
    zIndex: 20,
  },
  centerFlare: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 120,
    height: 120,
    marginLeft: -60,
    marginTop: -60,
    borderRadius: 60,
    opacity: 0.6,
    zIndex: 30,
    shadowColor: '#fff',
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
});



