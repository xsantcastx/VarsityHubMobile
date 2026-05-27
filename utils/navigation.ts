import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useContext } from 'react';
import {
  getNavigationFallback,
  NavigationHistoryContext,
  performTrackedSafeBack,
} from '@/context/NavigationHistoryContext';

/**
 * Standalone safe back for imperative use — pass the router from useRouter().
 * Uses NavigationHistoryContext (via global getter) to fall back to last-visited tab.
 */
export function safeGoBack(
  router: ReturnType<typeof useRouter>,
  explicitFallback?: Href | string
) {
  if (router.canGoBack()) {
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
 * Prefer the tracked prior route when a screen has an explicit back button and
 * Expo Router's native stack would otherwise pop to a less specific screen.
 */
export function goBackToTrackedRoute(
  router: ReturnType<typeof useRouter>,
  currentHref: string | null | undefined,
  trackedPreviousHref: string | null | undefined,
  explicitFallback?: Href | string
) {
  if (trackedPreviousHref && trackedPreviousHref !== currentHref) {
    router.replace(trackedPreviousHref as Href);
    return;
  }

  safeGoBack(router, explicitFallback);
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
