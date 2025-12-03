/**
 * AuthProvider - Centralized authentication and routing logic
 * 
 * Fixes production issues:
 * - Eliminates competing User.me() calls in _layout, index, and sign-in
 * - Provides single source of truth for auth state
 * - Prevents route flicker and redirect loops
 * - Exposes health check status for offline UX
 */

import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { httpGet } from '@/api/http';

interface AuthUser {
  id: string;
  email: string;
  username?: string;
  role?: string;
  preferences?: {
    onboarding_completed?: boolean;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  healthOk: boolean;
  healthError: string | null;
  isAdmin: boolean;
  checkAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthOk, setHealthOk] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  
  const lastRedirectRef = React.useRef<string | null>(null);

  // Derived state
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  // Check backend health (once on startup)
  const checkHealth = useCallback(async () => {
    try {
      await httpGet('/health');
      setHealthOk(true);
      setHealthError(null);
      return true;
    } catch (err: any) {
      setHealthOk(false);
      const message = typeof err?.message === 'string' ? err.message : 'API unreachable';
      setHealthError(message);
      return false;
    }
  }, []);

  // Check authentication
  const checkAuth = useCallback(async () => {
    try {
      const me: any = await User.me();
      setUser(me);
      return me;
    } catch (err: any) {
      setUser(null);
      throw err;
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setUser(null);
    router.replace('/sign-in');
  }, [router]);

  // Initial auth check
  useEffect(() => {
    if (!navState?.key) return;

    let mounted = true;

    (async () => {
      // 1. Check health first
      const healthy = await checkHealth();
      
      if (!mounted) return;

      // 2. If backend is down, we can't authenticate
      if (!healthy) {
        setLoading(false);
        setInitializing(false);
        // Don't redirect - let user see offline banner
        return;
      }

      // 3. Check auth status
      try {
        await checkAuth();
      } catch (err: any) {
        // Auth failed - user not logged in
        // Don't redirect here - let the routing logic below handle it
      } finally {
        if (mounted) {
          setLoading(false);
          setInitializing(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navState?.key, checkHealth, checkAuth]);

  // Routing logic (runs after auth check completes)
  useEffect(() => {
    if (initializing || !navState?.key) return;

    const firstSegment = Array.isArray(segments) && segments.length ? String(segments[0]) : '';
    const publicRoutes = new Set(['sign-in', 'sign-up', 'verify-email', 'forgot-password', 'reset-password']);
    const isPublic = publicRoutes.has(firstSegment);

    // If backend is unhealthy, don't do any redirects
    if (!healthOk) {
      return;
    }

    // Authenticated routing
    if (user) {
      const needsOnboarding = user.preferences?.onboarding_completed === false;

      // If needs onboarding and not already there
      if (needsOnboarding && firstSegment !== 'onboarding') {
        if (lastRedirectRef.current !== '/onboarding/step-1-role') {
          lastRedirectRef.current = '/onboarding/step-1-role';
          router.replace('/onboarding/step-1-role');
        }
        return;
      }

      // If on public route and doesn't need onboarding (but NOT verify-email)
      if (isPublic && !needsOnboarding && firstSegment !== 'verify-email') {
        const landingRoute = '/(tabs)';
        if (lastRedirectRef.current !== landingRoute) {
          lastRedirectRef.current = landingRoute;
          router.replace(landingRoute as any);
        }
        return;
      }
    }

    // Unauthenticated routing
    if (!user && !isPublic) {
      if (lastRedirectRef.current !== '/sign-in') {
        lastRedirectRef.current = '/sign-in';
        router.replace('/sign-in');
      }
    }
  }, [user, initializing, healthOk, segments, navState?.key, router]);

  const value: AuthContextType = {
    user,
    loading,
    healthOk,
    healthError,
    isAdmin,
    checkAuth,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
