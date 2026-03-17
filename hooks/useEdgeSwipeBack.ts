import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useContext } from 'react';
import { NavigationHistoryContext } from '@/context/NavigationHistoryContext';

const EDGE_WIDTH = 40; // Left edge zone in px
const SWIPE_THRESHOLD = 60; // Min horizontal distance to trigger back
const DEFAULT_FALLBACK = '/(tabs)/feed';

/**
 * Edge-swipe-to-go-back gesture for tab screens that lack native back navigation.
 * Uses manual activation so only touches starting in the left edge zone activate,
 * letting ScrollViews handle all other touches normally.
 */
export function useEdgeSwipeBack() {
  const router = useRouter();
  const navHistory = useContext(NavigationHistoryContext);
  const startedAtEdge = useSharedValue(false);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      const fallback = navHistory?.getFallbackRoute?.() ?? DEFAULT_FALLBACK;
      router.replace(fallback as any);
    }
  };

  const edgeSwipeGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e) => {
      'worklet';
      const touch = e.allTouches[0];
      startedAtEdge.value = touch ? touch.x <= EDGE_WIDTH : false;
    })
    .onTouchesMove((e, stateManager) => {
      'worklet';
      if (!startedAtEdge.value) {
        stateManager.fail();
        return;
      }
      // Activate once we see enough horizontal movement
      const touch = e.allTouches[0];
      if (touch && touch.x > EDGE_WIDTH + 15) {
        stateManager.activate();
      }
    })
    .onEnd((e) => {
      'worklet';
      if (
        startedAtEdge.value &&
        e.translationX > SWIPE_THRESHOLD &&
        Math.abs(e.translationY) < e.translationX
      ) {
        runOnJS(goBack)();
      }
    });

  // Allow native scroll gestures to work simultaneously
  const nativeGesture = Gesture.Native();
  const composedGesture = Gesture.Simultaneous(edgeSwipeGesture, nativeGesture);

  return { edgeSwipeGesture: composedGesture };
}
