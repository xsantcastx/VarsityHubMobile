import { useRouter } from 'expo-router';

/**
 * Safe navigation utility that prevents GO_BACK errors
 */
export function useSafeNavigation() {
  const router = useRouter();

  const safeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback to main tabs if no navigation stack exists
      router.push('/(tabs)' as any);
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
      router.push('/(tabs)' as any);
    }
  };
}