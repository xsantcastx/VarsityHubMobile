import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useContext } from 'react';
import {
  NavigationHistoryContext,
  getNavigationFallback,
} from '@/context/NavigationHistoryContext';
import { SPRING_DEFAULT } from '@/constants/motion';
import { shouldDismissSwipe } from '@/utils/swipeBack';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptics } from '@/utils/haptics';

const EDGE_WIDTH = 40; // Left edge zone in px
const ACTIVATE_SLOP = 15; // Horizontal movement past the edge zone before we own the gesture

/**
 * Edge-swipe-to-go-back for tab screens that lack native back navigation.
 *
 * Unlike a binary "detect swipe → navigate" recognizer, this tracks the screen
 * 1:1 with the finger (apple-design §2), so the drag has continuous feedback and
 * is interruptible — drag out and back, release to cancel and it springs home.
 * At release, the commit-vs-return decision uses momentum projection
 * (`shouldDismissSwipe`, apple-design §6): a hard flick commits from a short drag.
 *
 * Returns an `animatedStyle` the caller applies to the screen's content wrapper,
 * plus the composed gesture. Both share one translateX so the drag and the
 * spring stay on the UI thread.
 */
export function useEdgeSwipeBack() {
  const router = useRouter();
  const navHistory = useContext(NavigationHistoryContext);
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const startedAtEdge = useSharedValue(false);
  const translateX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: translateX.value }] }),
    []
  );

  const goBack = () => {
    if (navHistory?.safeGoBack) {
      navHistory.safeGoBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    const fallback = navHistory?.getFallbackRoute?.() ?? getNavigationFallback();
    router.replace(fallback as any);
  };

  // Runs on the JS thread at commit: subtle haptic, navigate, then reset the
  // shared value to 0 so a persistent (tab) screen is never left offset.
  const commitBack = () => {
    haptics.impact('light');
    goBack();
    translateX.value = 0;
  };

  const edgeSwipeGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e, stateManager) => {
      'worklet';
      const touch = e.allTouches[0];
      if (!touch || touch.x > EDGE_WIDTH) {
        // Fail immediately for non-edge touches so Pressables respond on first tap
        stateManager.fail();
        startedAtEdge.value = false;
      } else {
        startedAtEdge.value = true;
      }
    })
    .onTouchesMove((e, stateManager) => {
      'worklet';
      if (!startedAtEdge.value) {
        stateManager.fail();
        return;
      }
      const touch = e.allTouches[0];
      if (touch && touch.x > EDGE_WIDTH + ACTIVATE_SLOP) {
        stateManager.activate();
      }
    })
    .onUpdate(e => {
      'worklet';
      if (!startedAtEdge.value || reduceMotion) return;
      // 1:1 rightward tracking; can't drag left of the origin.
      translateX.value = Math.max(0, e.translationX);
    })
    .onEnd(e => {
      'worklet';
      if (!startedAtEdge.value) return;
      const horizontal = Math.abs(e.translationY) < Math.abs(e.translationX);
      if (horizontal && shouldDismissSwipe(e.translationX, e.velocityX, width)) {
        runOnJS(commitBack)();
      } else {
        // Return to origin with a graceful settle.
        translateX.value = withSpring(0, SPRING_DEFAULT);
      }
    });

  // Allow native scroll gestures to work simultaneously
  const nativeGesture = Gesture.Native();
  const composedGesture = Gesture.Simultaneous(edgeSwipeGesture, nativeGesture);

  return { edgeSwipeGesture: composedGesture, animatedStyle };
}
