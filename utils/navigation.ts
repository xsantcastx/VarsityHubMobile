import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useContext } from 'react';
import {
  getNavigationFallback,
  markNextHistoryEntryAsRedirect,
  NavigationHistoryContext,
  performTrackedSafeBack,
} from '@/context/NavigationHistoryContext';

/**
 * Standalone safe back for imperative use — pass the router from useRouter().
 * Uses NavigationHistoryContext (via global getter) to fall back to last-visited tab.
 */
export function safeGoBack(router: ReturnType<typeof useRouter>, explicitFallback?: Href | string) {
  if (router.canGoBack()) {
    // A back pop must not be recorded as a forward visit: without the mark,
    // the screen being left lands on the history top and the next
    // history-based back sends the user FORWARD to it (the back-loop bug).
    markNextHistoryEntryAsRedirect();
    router.back();
    return;
  }

  if (performTrackedSafeBack(explicitFallback)) {
    return;
  }

  const fallback = explicitFallback ?? getNavigationFallback();
  router.replace(fallback as Href);
}

/**
 * router.replace for AUTO-redirects (canonical-page bounces, guard bounces,
 * auto-forwards). Marks the transition so the redirecting screen is never
 * recorded in tracked history — a recorded redirect becomes a back target
 * that instantly bounces the user forward again.
 */
export function replaceAsRedirect(router: ReturnType<typeof useRouter>, href: Href | string) {
  markNextHistoryEntryAsRedirect();
  router.replace(href as Href);
}

/**
 * Safe navigation utility that prevents GO_BACK errors.
 * Uses last-visited tab when history is empty.
 */
export function useSafeNavigation() {
  const router = useRouter();
  const navHistory = useContext(NavigationHistoryContext);

  const safeBack = () => {
    if (navHistory?.safeGoBack) {
      navHistory.safeGoBack();
      return;
    }

    if (router.canGoBack()) {
      markNextHistoryEntryAsRedirect();
      router.back();
      return;
    }

    const fallback = navHistory?.getFallbackRoute?.() ?? getNavigationFallback();
    router.replace(fallback as Href);
  };

  return {
    ...router,
    safeBack,
  };
}

/**
 * Standalone safe back function for use outside hooks.
 * Requires getFallback from useNavigationHistory when used in tab screens.
 */
export function createSafeBack(
  router: ReturnType<typeof useRouter>,
  explicitFallback?: Href | string
) {
  return () => {
    safeGoBack(router, explicitFallback);
  };
}
