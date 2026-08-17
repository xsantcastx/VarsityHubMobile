import React from 'react';
import { type ViewProps } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';

/**
 * Wraps children with an edge-swipe-to-go-back gesture recognizer.
 * Use this on screens inside a Tabs navigator that need iOS-style
 * swipe-from-left-edge back navigation.
 *
 * The screen content tracks the finger 1:1 during the drag (via the hook's
 * animatedStyle) and springs home on cancel — see useEdgeSwipeBack.
 */
export default function SwipeBackContainer({
  children,
  style,
  ...rest
}: ViewProps & { children: React.ReactNode }) {
  const { edgeSwipeGesture, animatedStyle } = useEdgeSwipeBack();

  return (
    <GestureDetector gesture={edgeSwipeGesture}>
      <Animated.View style={[{ flex: 1 }, animatedStyle, style]} {...rest}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
