import { useRouter } from 'expo-router';
import { useContext } from 'react';
import { getNavigationFallback, NavigationHistoryContext } from '@/context/NavigationHistoryContext';

/**
 * Standalone safe back for imperative use — pass the router from useRouter().
 * Uses NavigationHistoryContext (via global getter) to fall back to last-visited tab.
 */
export function safeGoBack(
  router: ReturnType<typeof useRouter>,
  explicitFallback?: string
) {
  if (router.canGoBack()) {
    router.back();
  } else {
    const fallback = explicitFallback ?? getNavigationFallback();
    router.replace(fallback as any);
  }
}

/**
 * Safe navigation utility that prevents GO_BACK errors.
 * Uses last-visited tab when history is empty.
 */
export function useSafeNavigation() {
  const router = useRouter();
  const navHistory = useContext(NavigationHistoryContext);

  const safeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      const fallback = navHistory?.getFallbackRoute?.() ?? getNavigationFallback();
      router.replace(fallback as any);
    }
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
  explicitFallback?: string
) {
  return () => {
    safeGoBack(router, explicitFallback);
  };
}