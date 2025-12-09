/**
 * AuthProvider - Centralized authentication and routing logic
 * 
 * Fixes production issues:
 * - Eliminates competing User.me() calls in _layout, index, and sign-in
 * - Provides single source of truth for auth state
 * - Prevents route flicker and redirect loops
 * - Exposes health check status for offline UX
 * - Unified auth paths: all flows call checkAuth() and let provider handle routing
 * - Email verification: detected and routed centrally; verify-email screen shows user context
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
// @ts-ignore JS exports
import auth from '@/api/auth';
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

export interface AuthContextType {
  user: AuthUser | null;
  pendingVerificationEmail: string | null;
  loading: boolean;
  healthOk: boolean;
  healthError: string | null;
  isAdmin: boolean;
  checkAuth: (options?: { email?: string; pendingVerification?: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
  registerPushToken: () => Promise<boolean>;
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
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthOk, setHealthOk] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  
  const lastRedirectRef = React.useRef<string | null>(null);
  const segmentsRef = React.useRef(segments);
  
  // Update segments ref on every render
  React.useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

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

  const lastPushRegistrationRef = React.useRef<string | null>(null);

  // Register for push notifications
  const setupPushNotifications = useCallback(async (userId: string) => {
    if (!userId) return false;
    if (!Device.isDevice) {
      console.log('[PushNotifications] Skipping setup on simulator/emulator');
      return false;
    }
    if (lastPushRegistrationRef.current === userId) {
      // Already registered for this user during this session
      return true;
    }

    try {
      // 1. Check existing permissions
      let permissions = await Notifications.getPermissionsAsync();
      if (permissions.status !== 'granted') {
        permissions = await Notifications.requestPermissionsAsync();
      }

      if (permissions.status !== 'granted') {
        console.log('[PushNotifications] Permission denied by user');
        return false;
      }

      // 2. Get project ID from app config
      let projectId = null;
      try {
        const appJson = require('../app.json');
        projectId = appJson?.expo?.extra?.eas?.projectId;
      } catch {
        console.error('[PushNotifications] Could not load app.json for projectId');
      }

      if (!projectId) {
        console.error('[PushNotifications] EXPO_PROJECT_ID not found in app.json');
        return false;
      }

      // 3. Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      
      const token = tokenData.data;
      console.log('[PushNotifications] Got push token:', token.substring(0, 30) + '...');

      // 4. Save token to backend
      await User.updatePreferences({ 
        push_token: token,
        notifications_enabled: true
      });
      
      console.log('[PushNotifications] ✅ Push token saved to backend');
      lastPushRegistrationRef.current = userId;
      return true;
    } catch (error: any) {
      console.error('[PushNotifications] Failed to setup:', error?.message || error);
      // Don't block app - push notifications are optional
      return false;
    }
  }, []);

  // Check authentication
  const checkAuth = useCallback(
    async (options?: { email?: string; pendingVerification?: boolean }) => {
      try {
        // If pending verification flag is set, store email and don't try to fetch user
        if (options?.pendingVerification && options?.email) {
          setPendingVerificationEmail(options.email);
          setUser(null); // Don't set user until verification succeeds
          return;
        }

        // Try to fetch current user only if we have a token
        const token = await auth.getToken();
        if (!token) {
          setUser(null);
          return;
        }

        const me: any = await User.me();
        setUser(me);
        setPendingVerificationEmail(null); // Clear pending email after successful auth

        // Setup push notifications after successful auth
        void setupPushNotifications(me.id);

        return me;
      } catch (err: any) {
        setUser(null);
        throw err;
      }
    },
    [setupPushNotifications]
  );

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await auth.logout();
    } catch (error) {
      console.warn('[auth] Failed to clear persisted session during sign out:', error);
    } finally {
      setUser(null);
      setPendingVerificationEmail(null);
      lastPushRegistrationRef.current = null;
      router.replace('/sign-in');
    }
  }, [router]);

  const registerPushToken = useCallback(async () => {
    if (!user?.id) return false;
    return setupPushNotifications(user.id);
  }, [setupPushNotifications, user?.id]);

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
    if (initializing) return;

    const firstSegment = Array.isArray(segmentsRef.current) && segmentsRef.current.length ? String(segmentsRef.current[0]) : '';
    const publicRoutes = new Set(['sign-in', 'sign-up', 'verify-email', 'forgot-password', 'reset-password']);
    const isPublic = publicRoutes.has(firstSegment);

    // If backend is unhealthy, don't do any redirects
    if (!healthOk) {
      return;
    }

    // If user is awaiting email verification, navigate to verify-email
    if (pendingVerificationEmail && firstSegment !== 'verify-email') {
      if (lastRedirectRef.current !== '/verify-email') {
        lastRedirectRef.current = '/verify-email';
        router.replace('/verify-email');
      }
      return;
    }

    // Authenticated routing
    if (user) {
      const needsOnboarding = user.preferences?.onboarding_completed === false;

      // If needs onboarding and not already there, redirect to start onboarding
      if (needsOnboarding && firstSegment !== 'onboarding') {
        if (lastRedirectRef.current !== '/onboarding/step-1-role') {
          lastRedirectRef.current = '/onboarding/step-1-role';
          router.replace('/onboarding/step-1-role');
        }
        return;
      }

      // If onboarding is complete and user is still on onboarding route, send to main app
      if (!needsOnboarding && firstSegment === 'onboarding') {
        const landingRoute = '/(tabs)';
        if (lastRedirectRef.current !== landingRoute) {
          lastRedirectRef.current = landingRoute;
          router.replace(landingRoute as any);
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
    if (!user && !pendingVerificationEmail && !isPublic) {
      if (lastRedirectRef.current !== '/sign-in') {
        lastRedirectRef.current = '/sign-in';
        router.replace('/sign-in');
      }
    }
  }, [user, pendingVerificationEmail, initializing, healthOk, navState?.key, router]);

  const value: AuthContextType = {
    user,
    pendingVerificationEmail,
    loading,
    healthOk,
    healthError,
    isAdmin,
    checkAuth,
    signOut,
    registerPushToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
