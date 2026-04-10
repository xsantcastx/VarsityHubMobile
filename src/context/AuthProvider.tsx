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

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
// @ts-ignore JS exports
import auth from '@/api/auth';
import { User } from '@/api/entities';
import { httpGet } from '@/api/http';

// Conditionally import notifications only if not in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';
let Notifications: any = null;
if (!isExpoGo) {
  Notifications = require('expo-notifications');
}

interface AuthUser {
  id: string;
  email: string;
  username?: string;
  role?: string;
  is_admin?: boolean;
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
  markOnboardingCompleteLocally: () => Promise<void>;
  markOnboardingIncompleteLocally: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
  navReady: boolean;
}

export function AuthProvider({ children, navReady }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthOk, setHealthOk] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);

  const ONBOARDING_COMPLETE_KEY = '@onboarding_completed_once';

  const router = useRouter();
  const segments = useSegments();

  const lastRedirectRef = React.useRef<string | null>(null);
  const segmentsRef = React.useRef(segments);

  // Update segments ref on every render
  React.useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Derived state
  const isAdmin = user?.is_admin === true;

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

    // Skip push notifications in Expo Go
    if (isExpoGo || !Notifications) {
      console.log('[PushNotifications] Skipping setup in Expo Go environment');
      return false;
    }

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
        notifications_enabled: true,
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

        // ALWAYS sync local flag with server truth
        const serverComplete = me?.preferences?.onboarding_completed === true;
        if (serverComplete && !hasCompletedOnboarding) {
          setHasCompletedOnboarding(true);
          await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
        } else if (!serverComplete && hasCompletedOnboarding) {
          // Server says incomplete but local says complete - trust server, clear local
          setHasCompletedOnboarding(false);
          await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
        }

        // Push notifications are requested during onboarding step 9 (with pre-prompt),
        // not immediately after login.

        return me;
      } catch (err: any) {
        setUser(null);
        // Don't clear onboarding flag on auth error - keep it for when user logs back in
        // Only throw if it's not a 401 (unauthorized) - 401 is expected when not logged in
        if (err?.status !== 401) {
          console.error('[AuthProvider] checkAuth error:', err);
        }
        throw err;
      }
    },
    [hasCompletedOnboarding]
  );

  const checkAuthRef = React.useRef(checkAuth);
  React.useEffect(() => {
    checkAuthRef.current = checkAuth;
  }, [checkAuth]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await auth.logout();
    } catch (error) {
      console.warn('[auth] Failed to clear persisted session during sign out:', error);
    } finally {
      setUser(null);
      setPendingVerificationEmail(null);
      setHasCompletedOnboarding(false);
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      lastPushRegistrationRef.current = null;
      router.replace('/sign-in');
    }
  }, [router]);

  const registerPushToken = useCallback(async () => {
    if (!user?.id) return false;
    return setupPushNotifications(user.id);
  }, [setupPushNotifications, user?.id]);

  const markOnboardingCompleteLocally = useCallback(async () => {
    try {
      setHasCompletedOnboarding(true);
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch (error) {
      console.warn('[Auth] Failed to persist onboarding completion flag:', error);
    }
  }, []);

  const markOnboardingIncompleteLocally = useCallback(async () => {
    try {
      setHasCompletedOnboarding(false);
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    } catch (error) {
      console.warn('[Auth] Failed to clear onboarding completion flag:', error);
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    if (!navReady) {
      console.log('[AuthProvider] Waiting for navigation state...');
      return;
    }

    console.log('[AuthProvider] Navigation ready, starting auth check');
    let mounted = true;

    (async () => {
      // 1. Check health first
      console.log('[AuthProvider] Checking backend health...');
      const healthy = await checkHealth();
      console.log('[AuthProvider] Health check result:', healthy);

      if (!mounted) return;

      // 2. If backend is down, we can't authenticate
      if (!healthy) {
        console.log('[AuthProvider] Backend unhealthy, stopping initialization');
        setLoading(false);
        setInitializing(false);
        // Don't redirect - let user see offline banner
        return;
      }

      // 3. Check auth status
      console.log('[AuthProvider] Checking authentication...');
      try {
        await checkAuthRef.current();
        console.log('[AuthProvider] Auth check successful');
      } catch (err: any) {
        console.log('[AuthProvider] Auth check failed (user not logged in):', err.message);
        // Auth failed - user not logged in
        // Don't redirect here - let the routing logic below handle it
      } finally {
        if (mounted) {
          console.log('[AuthProvider] Initialization complete');
          setLoading(false);
          setInitializing(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navReady, checkHealth]);

  // Safety timeout - force initialization complete after 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (initializing) {
        console.warn('[AuthProvider] ⚠️ Initialization timeout (5s) - forcing completion');
        setLoading(false);
        setInitializing(false);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [initializing]);

  // Load onboarding completion flag from AsyncStorage once on mount
  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] AsyncStorage timeout - assuming onboarding incomplete');
        setHasCompletedOnboarding(false);
      }
    }, 2000);

    (async () => {
      try {
        const storedValue = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        clearTimeout(timeout);
        if (mounted) {
          setHasCompletedOnboarding(storedValue === 'true');
        }
      } catch (error) {
        clearTimeout(timeout);
        console.warn('[Auth] Failed to load onboarding flag from storage:', error);
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  // Routing logic (runs after auth check completes)
  useEffect(() => {
    if (initializing) {
      console.log('[AuthProvider] Still initializing, skipping routing');
      return;
    }

    const firstSegment =
      Array.isArray(segmentsRef.current) && segmentsRef.current.length
        ? String(segmentsRef.current[0])
        : '';
    const publicRoutes = new Set([
      'sign-in',
      'sign-up',
      'verify-email',
      'verify',
      'verify-identity',
      'forgot-password',
      'reset-password',
    ]);
    const isPublic = publicRoutes.has(firstSegment);

    console.log(
      '[AuthProvider] Routing check - segment:',
      firstSegment,
      'user:',
      !!user,
      'pendingVerif:',
      !!pendingVerificationEmail
    );

    // If backend is unhealthy, don't do any redirects
    if (!healthOk) {
      console.log('[AuthProvider] Backend unhealthy, skipping routing');
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
      // SERVER IS SOURCE OF TRUTH for onboarding completion
      // Admin accounts always have onboarding_completed=true on server, so they bypass onboarding
      // Regular users are marked false if they haven't completed onboarding
      const serverSaysIncomplete = user.preferences?.onboarding_completed === false;

      // Both conditions must be true: server says incomplete AND local flag not set
      // hasCompletedOnboarding is a fallback for the window between onboarding completion and
      // the next checkAuth() call - prevents a re-render from sending user back to onboarding
      const needsOnboarding = serverSaysIncomplete && !hasCompletedOnboarding;

      // If needs onboarding and not already there, redirect to start onboarding
      if (needsOnboarding && firstSegment !== 'onboarding') {
        console.log('[AuthProvider] User needs onboarding, redirecting to step 1');
        if (lastRedirectRef.current !== '/onboarding/step-1-role') {
          lastRedirectRef.current = '/onboarding/step-1-role';
          router.replace('/onboarding/step-1-role');
        }
        return;
      }

      // If onboarding is complete and user is still on onboarding route, send to main app
      if (!needsOnboarding && firstSegment === 'onboarding') {
        console.log('[AuthProvider] User completed onboarding, redirecting to main app');
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
        console.log('[AuthProvider] Redirecting to sign-in (unauthenticated)');
        lastRedirectRef.current = '/sign-in';
        router.replace('/sign-in');
      }
    }
  }, [user, pendingVerificationEmail, initializing, healthOk, router, hasCompletedOnboarding]);

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
    markOnboardingCompleteLocally,
    markOnboardingIncompleteLocally,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
