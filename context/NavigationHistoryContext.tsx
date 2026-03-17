/**
 * NavigationHistoryContext - Tracks last-visited tab/screen for back button fallback.
 *
 * When Expo Router loses the navigation stack (router.canGoBack() returns false),
 * we replace to the last-visited tab instead of always going to feed.
 */
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';

const TAB_ROUTES = ['feed', 'discover', 'profile', 'highlights'] as const;
export const DEFAULT_FALLBACK = '/(tabs)/feed' as const;

/** Module-level fallback for safeGoBack(router) when used outside React tree (e.g. Alert callbacks) */
let globalGetFallback: (() => string) | null = null;
export function setNavigationFallbackGetter(fn: (() => string) | null) {
  globalGetFallback = fn;
}
export function getNavigationFallback(): string {
  return globalGetFallback?.() ?? DEFAULT_FALLBACK;
}

type TabRoute = (typeof TAB_ROUTES)[number];

function isTabRoute(segment: string): segment is TabRoute {
  return TAB_ROUTES.includes(segment as TabRoute);
}

function segmentsToRoute(segments: string[]): string {
  if (segments.length < 2) return DEFAULT_FALLBACK;
  const tabSegment = segments[1];
  if (isTabRoute(tabSegment)) {
    return `/(tabs)/${tabSegment}` as const;
  }
  return DEFAULT_FALLBACK;
}

interface NavigationHistoryContextType {
  /** Navigate back; if canGoBack() is false, replace to last-visited tab */
  safeGoBack: () => void;
  /** Get the fallback route when history is empty (for imperative use) */
  getFallbackRoute: () => string;
}

export const NavigationHistoryContext = createContext<NavigationHistoryContextType | undefined>(undefined);

export function useNavigationHistory() {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error('useNavigationHistory must be used within NavigationHistoryProvider');
  }
  return context;
}

/**
 * Hook that returns a safeGoBack function. Safe to use even when
 * NavigationHistoryProvider is not in the tree (falls back to feed).
 * @param explicitFallback - When provided, use this route when canGoBack is false (e.g. '/(tabs)/my-ads')
 */
export function useSafeGoBack(explicitFallback?: string): () => void {
  const router = useRouter();
  const context = useContext(NavigationHistoryContext);

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      const fallback = explicitFallback ?? context?.getFallbackRoute?.() ?? DEFAULT_FALLBACK;
      router.replace(fallback as any);
    }
  }, [router, context, explicitFallback]);
}

interface NavigationHistoryProviderProps {
  children: React.ReactNode;
}

export function NavigationHistoryProvider({ children }: NavigationHistoryProviderProps) {
  const router = useRouter();
  const segments = useSegments();
  const lastTabRouteRef = useRef<string>(DEFAULT_FALLBACK);

  // Update last-visited tab only when user is on a tab screen (feed, discover, profile, highlights)
  useEffect(() => {
    const segStrings = segments.map((s) => String(s));
    if (segStrings.length >= 2 && isTabRoute(segStrings[1])) {
      lastTabRouteRef.current = segmentsToRoute(segStrings);
    }
  }, [segments]);

  const getFallbackRoute = useCallback(() => lastTabRouteRef.current, []);

  const safeGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(lastTabRouteRef.current as any);
    }
  }, [router]);

  const value = React.useMemo(
    () => ({ safeGoBack, getFallbackRoute }),
    [safeGoBack, getFallbackRoute]
  );

  // Expose getFallbackRoute globally so safeGoBack(router) in utils/navigation can use it
  React.useEffect(() => {
    setNavigationFallbackGetter(getFallbackRoute);
    return () => setNavigationFallbackGetter(null);
  }, [getFallbackRoute]);

  return (
    <NavigationHistoryContext.Provider value={value}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}
