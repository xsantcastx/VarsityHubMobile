/**
 * NavigationHistoryContext - Maintains a navigation history stack for back button.
 *
 * Expo Router's canGoBack() returns false in Tabs when navigating to nested screens.
 * We track every screen visit and use that stack when back is pressed.
 */
import type { Href } from 'expo-router';
import { useRouter, useSegments, useUnstableGlobalHref } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';

const TAB_ROUTES = ['feed', 'discover', 'profile', 'highlights', 'create'] as const;
export const DEFAULT_FALLBACK = '/(tabs)/feed' as const;
const MAX_HISTORY = 50;

/** Module-level fallback for safeGoBack(router) when used outside React tree (e.g. Alert callbacks) */
let globalGetFallback: (() => string) | null = null;
let globalGetCurrentHref: (() => string | null) | null = null;
let globalSafeBack: ((explicitFallback?: Href | string) => boolean) | null = null;
let globalMarkNextHistoryEntryAsRedirect: (() => void) | null = null;
export function setNavigationFallbackGetter(fn: (() => string) | null) {
  globalGetFallback = fn;
}
export function getNavigationFallback(): string {
  return globalGetFallback?.() ?? DEFAULT_FALLBACK;
}
export function setCurrentHrefGetter(fn: (() => string | null) | null) {
  globalGetCurrentHref = fn;
}
export function getCurrentHref(): string | null {
  return globalGetCurrentHref?.() ?? null;
}
export function setNavigationSafeBackHandler(
  fn: ((explicitFallback?: Href | string) => boolean) | null
) {
  globalSafeBack = fn;
}
export function performTrackedSafeBack(explicitFallback?: Href | string): boolean {
  return globalSafeBack?.(explicitFallback) ?? false;
}
export function setMarkNextHistoryEntryAsRedirect(fn: (() => void) | null) {
  globalMarkNextHistoryEntryAsRedirect = fn;
}
export function markNextHistoryEntryAsRedirect() {
  globalMarkNextHistoryEntryAsRedirect?.();
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
  safeGoBack: (explicitFallback?: Href | string) => void;
  getFallbackRoute: () => string;
}

export const NavigationHistoryContext = createContext<NavigationHistoryContextType | undefined>(
  undefined
);

export function useNavigationHistory() {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error('useNavigationHistory must be used within NavigationHistoryProvider');
  }
  return context;
}

/**
 * Hook that returns a safeGoBack function.
 * @param explicitFallback - When provided, use this route when canGoBack is false (e.g. '/(tabs)/my-ads')
 */
export function useSafeGoBack(explicitFallback?: Href | string): () => void {
  const router = useRouter();
  const context = useContext(NavigationHistoryContext);

  return useCallback(() => {
    if (context?.safeGoBack) {
      context.safeGoBack(explicitFallback);
      return;
    }

    if (router.canGoBack()) {
      markNextHistoryEntryAsRedirect();
      router.back();
      return;
    }

    const fallback = explicitFallback ?? context?.getFallbackRoute?.() ?? DEFAULT_FALLBACK;
    router.replace(fallback as any);
  }, [router, context, explicitFallback]);
}

interface NavigationHistoryProviderProps {
  children: React.ReactNode;
}

export function NavigationHistoryProvider({ children }: NavigationHistoryProviderProps) {
  const router = useRouter();
  const href = useUnstableGlobalHref();
  const segments = useSegments();
  const lastTabRouteRef = useRef<string>(DEFAULT_FALLBACK);
  const historyRef = useRef<string[]>([]);
  const prevHrefRef = useRef<string | null>(null);
  const isNavigatingBackRef = useRef(false);
  const skipNextHistoryEntryRef = useRef(false);

  // Use full href (path + params) so back preserves query params
  const currentHref =
    typeof href === 'string' ? href : `/${segments.map(s => String(s)).join('/')}`;

  // On every route change: push previous href to history (unless we just navigated back)
  useEffect(() => {
    const prev = prevHrefRef.current;
    prevHrefRef.current = currentHref;

    if (isNavigatingBackRef.current) {
      isNavigatingBackRef.current = false;
      return;
    }
    if (skipNextHistoryEntryRef.current) {
      skipNextHistoryEntryRef.current = false;
      return;
    }
    if (prev != null && prev !== currentHref) {
      historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), prev];
    }
  }, [currentHref]);

  // Update last-visited tab when on a tab root
  useEffect(() => {
    const segStrings = segments.map(s => String(s));
    if (segStrings.length >= 2 && isTabRoute(segStrings[1])) {
      lastTabRouteRef.current = segmentsToRoute(segStrings);
    }
  }, [segments]);

  const getFallbackRoute = useCallback(() => {
    const hist = historyRef.current;
    if (hist.length > 0) return hist[hist.length - 1];
    return lastTabRouteRef.current;
  }, []);

  const safeGoBack = useCallback(
    (explicitFallback?: Href | string) => {
      if (router.canGoBack()) {
        // Back pops are not forward visits — don't record the screen being
        // left, or it becomes the next history-based back's (forward) target.
        isNavigatingBackRef.current = true;
        router.back();
        return true;
      }
      const hist = historyRef.current;
      if (hist.length > 0) {
        const target = hist[hist.length - 1];
        historyRef.current = hist.slice(0, -1);
        isNavigatingBackRef.current = true;
        router.replace(target as any);
        return true;
      } else {
        router.replace((explicitFallback ?? lastTabRouteRef.current) as any);
        return true;
      }
    },
    [router]
  );

  const value = React.useMemo(
    () => ({ safeGoBack, getFallbackRoute }),
    [safeGoBack, getFallbackRoute]
  );

  React.useEffect(() => {
    setNavigationFallbackGetter(getFallbackRoute);
    setNavigationSafeBackHandler(safeGoBack);
    setMarkNextHistoryEntryAsRedirect(() => {
      skipNextHistoryEntryRef.current = true;
    });
    return () => {
      setNavigationFallbackGetter(null);
      setNavigationSafeBackHandler(null);
      setMarkNextHistoryEntryAsRedirect(null);
    };
  }, [getFallbackRoute, safeGoBack]);

  React.useEffect(() => {
    setCurrentHrefGetter(() => currentHref);
    return () => setCurrentHrefGetter(null);
  }, [currentHref]);

  return (
    <NavigationHistoryContext.Provider value={value}>{children}</NavigationHistoryContext.Provider>
  );
}
