/**
 * Progress bar component for upload/download progress
 */
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export interface ProgressBarProps {
  /** Progress value from 0 to 1 */
  progress: number;
  /** Height of the progress bar */
  height?: number;
  /** Whether to show percentage text */
  showPercentage?: boolean;
  /** Custom label to show instead of percentage */
  label?: string;
  /** Whether to animate the progress */
  animated?: boolean;
  /** Color of the progress bar (defaults to theme tint) */
  color?: string;
  /** Background color of the track */
  trackColor?: string;
}

export function ProgressBar({
  progress,
  height = 8,
  showPercentage = false,
  label,
  animated = true,
  color,
  trackColor,
}: ProgressBarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const percentage = Math.round(clampedProgress * 100);

  const progressColor = color || Colors[colorScheme].tint;
  const bgColor = trackColor || Colors[colorScheme].surface;

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height, backgroundColor: bgColor, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              height,
              backgroundColor: progressColor,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>
      {(showPercentage || label) && (
        <Text style={[styles.label, { color: Colors[colorScheme].mutedText }]}>
          {label || `${percentage}%`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default ProgressBar;
