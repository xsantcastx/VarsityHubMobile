import React from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SPRING_DEFAULT, SPRING_PRESS } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptics } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  /** Fire a selection haptic on press-in (apple-design §13). */
  haptic?: boolean;
  /** Target scale while pressed. Default 0.97 (~3% — perceptible, not jarring). */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * A drop-in Pressable that springs its scale on press-in and back on release —
 * instant, physical press feedback (apple-design §1). Honors Reduce Motion (skips
 * the scale, keeps the press). Optional causal haptic.
 */
export default function PressableScale({
  haptic = false,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  style,
  children,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  // Explicit [] dep array so this works without Reanimated's Babel plugin (jest / web);
  // the shared value is tracked automatically and doesn't belong in the array.
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }), []);

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e: GestureResponderEvent) => {
        if (haptic) haptics.selection();
        if (!reduceMotion) scale.value = withSpring(scaleTo, SPRING_PRESS);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        if (!reduceMotion) scale.value = withSpring(1, SPRING_DEFAULT);
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
