import { useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

const EDGE_WIDTH = 30; // iOS-standard edge zone (left 30px)
const SWIPE_THRESHOLD = 80; // minimum horizontal distance to trigger back

/**
 * Provides a Pan gesture that mimics the iOS edge-swipe-to-go-back behaviour.
 * Useful for screens that live inside a Tabs navigator (which has no native
 * back-swipe support) or where a horizontal ScrollView / FlatList would
 * otherwise swallow the gesture.
 *
 * Usage:
 *   const { edgeSwipeGesture } = useEdgeSwipeBack();
 *   return (
 *     <GestureDetector gesture={edgeSwipeGesture}>
 *       <View style={{ flex: 1 }}>…</View>
 *     </GestureDetector>
 *   );
 */
export function useEdgeSwipeBack() {
  const router = useRouter();
  const startedAtEdge = useRef(false);

  const edgeSwipeGesture = Gesture.Pan()
    .activeOffsetX(20) // only activate after 20px horizontal move
    .failOffsetY([-15, 15]) // fail quickly if vertical
    .onBegin((e) => {
      // Only trigger when the touch starts within the left edge zone
      startedAtEdge.current = e.x <= EDGE_WIDTH;
    })
    .onEnd((e) => {
      if (
        startedAtEdge.current &&
        e.translationX > SWIPE_THRESHOLD &&
        Math.abs(e.translationY) < e.translationX // mostly horizontal
      ) {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push('/(tabs)' as any);
        }
      }
      startedAtEdge.current = false;
    });

  return { edgeSwipeGesture };
}
