import { useRouter } from 'expo-router';

/**
 * Standalone safe back for imperative use — pass the router from useRouter().
 * Navigates back if possible, otherwise falls back to the main tabs.
 */
export function safeGoBack(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) {
    router.back();
  } else {
    // No history (e.g. deep link) — replace to home so back doesn't loop
    router.replace('/(tabs)' as any);
  }
}

/**
 * Safe navigation utility that prevents GO_BACK errors
 */
export function useSafeNavigation() {
  const router = useRouter();

  const safeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // No history — replace to home so back doesn't loop
      router.replace('/(tabs)' as any);
    }
  };

  return {
    ...router,
    safeBack,
  };
}

/**
 * Standalone safe back function for use outside hooks
 */
export function createSafeBack(router: ReturnType<typeof useRouter>) {
  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  };
}