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
import { AppState } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
// @ts-ignore JS exports
import auth from '@/api/auth';
import { User } from '@/api/entities';
import { httpGet } from '@/api/http';
import { clearPostCacheOnLogout } from '@/context/PostCacheContext';
import { consumePendingDeepLink, handleDeepLink } from '@/utils/deepLinks';
import { captureException, setUserContext as setSentryUser } from '@/utils/sentry';
import { analytics, ANALYTICS_EVENTS } from '@/utils/analytics';
import { buildAuthRedirectFingerprint, navigateWithAuthRedirect } from '@/utils/authTelemetry';
import Notifications from '@/utils/notifications';

// Conditionally import notifications only if not in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

interface AuthUser {
  id: string;
  email: string;
  email_verified?: boolean;
  username?: string;
  role?: string;
  is_admin?: boolean;
  approval_status?: string;
  paid_by_owner?: boolean;
  required_coach_agreement_version?: number;
  preferences?: {
    onboarding_completed?: boolean;
    role?: string;
    plan?: string;
    pending_plan?: string;
    payment_pending?: boolean;
    payment_approved?: boolean;
    join_request_pending?: boolean;
    proceeding_as_fan?: boolean;
    coach_agreement_accepted_at?: string;
    coach_agreement_version?: number;
    organization_id?: string;
  };
}

export interface AuthContextType {
  user: AuthUser | null;
  pendingVerificationEmail: string | null;
  loading: boolean;
  healthOk: boolean;
  healthError: string | null;
  isAdmin: boolean;
  subscriptionTier: string;
  hasActiveSubscription: boolean;
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
  const [subscriptionTier, setSubscriptionTier] = useState<string>('rookie');
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);

  const ONBOARDING_COMPLETE_KEY = '@onboarding_completed_once';
  const ONBOARDING_COMPLETE_USER_KEY = '@onboarding_completed_user_id';
  const LAST_ONBOARDING_USER_KEY = '@last_onboarding_user_id';

  const router = useRouter();
  const segments = useSegments();

  const lastRedirectRef = React.useRef<string | null>(null);
  const segmentsRef = React.useRef(segments);
  // Guard against multiple in-flight coach-role restores triggered by repeated
  // effect runs. Cleared in the async block's finally.
  const restoringCoachRef = React.useRef(false);

  // Update segments ref on every render
  React.useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Derived state
  const normalizedRole = String(user?.role || '').toLowerCase();
  const isAdmin =
    normalizedRole === 'admin' || normalizedRole === 'super_admin' || user?.is_admin === true;

  // Check backend health (once on startup)
  const checkHealth = useCallback(async () => {
    try {
      // Health should answer quickly; don't let startup wait through long default retries.
      await httpGet('/health', {}, 5000, 0);
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
      if (__DEV__) console.log('[PushNotifications] Skipping setup in Expo Go environment');
      return false;
    }

    if (!Device.isDevice) {
      if (__DEV__) console.log('[PushNotifications] Skipping setup on simulator/emulator');
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
        if (__DEV__) console.log('[PushNotifications] Permission denied by user');
        return false;
      }

      // 2. Get project ID from app config
      let projectId = null;
      try {
        const appJson = require('../app.json');
        projectId = appJson?.expo?.extra?.eas?.projectId;
      } catch {
        if (__DEV__) console.error('[PushNotifications] Could not load app.json for projectId');
      }

      if (!projectId) {
        if (__DEV__) console.error('[PushNotifications] EXPO_PROJECT_ID not found in app.json');
        return false;
      }

      // 3. Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      const token = tokenData.data;
      if (__DEV__)
        console.log('[PushNotifications] Got push token:', token.substring(0, 30) + '...');

      // 4. Save token to backend (with retry on failure)
      const saveToken = async (attempt = 1): Promise<void> => {
        try {
          await User.updatePreferences({ push_token: token, notifications_enabled: true });
          if (__DEV__) console.log('[PushNotifications] Push token saved to backend');
          lastPushRegistrationRef.current = userId;
        } catch (err) {
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, attempt * 3000));
            return saveToken(attempt + 1);
          }
          throw err;
        }
      };
      await saveToken();
      return true;
    } catch (error: any) {
      if (__DEV__) console.error('[PushNotifications] Failed to setup:', error?.message || error);
      // Don't block app - push notifications are optional
      return false;
    }
  }, []);

  // Fetch subscription status
  const fetchSubscription = useCallback(async () => {
    try {
      const data = await httpGet('/payments/subscription/summary');
      if (data && typeof data === 'object') {
        setSubscriptionTier(data.plan || data.tier || 'rookie');
        setHasActiveSubscription(data.plan !== 'rookie' && data.status === 'active');
      }
    } catch {
      // Non-critical — keep defaults
    }
  }, []);

  // v1.0.2: refs for deferred push registration + paywall loop breaker (must be before checkAuth).
  const registerPushTokenRef = React.useRef<(() => Promise<boolean>) | null>(null);
  const paywallPushTsRef = React.useRef<number>(0);
  const pushTokenTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionFetchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasCurrentCoachAgreement = useCallback((authUser: AuthUser | null | undefined) => {
    if (!authUser) return false;
    const acceptedAt = authUser.preferences?.coach_agreement_accepted_at;
    const acceptedVersion = Number(authUser.preferences?.coach_agreement_version ?? 1);
    const requiredVersion = Number(authUser.required_coach_agreement_version ?? 1);
    return !!acceptedAt && acceptedVersion >= requiredVersion;
  }, []);

  // Check authentication
  const checkAuth = useCallback(
    async (options?: {
      email?: string;
      pendingVerification?: boolean;
      skipSubscriptionRefresh?: boolean;
    }) => {
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

        // If user is banned, clear session and redirect to sign-in
        if (me?.banned) {
          setUser(null);
          setSentryUser(null);
          setPendingVerificationEmail(null);
          try {
            await auth.logout();
          } catch {}
          return;
        }

        const serverComplete = me?.preferences?.onboarding_completed === true;

        // Sync local onboarding flag BEFORE setUser to prevent routing race condition.
        // The routing effect fires when `user` changes — if hasCompletedOnboarding is
        // stale from a different account, needsOnboarding evaluates wrong for one cycle.
        if (serverComplete) {
          setHasCompletedOnboarding(true);
          await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
          await AsyncStorage.setItem(ONBOARDING_COMPLETE_USER_KEY, me.id);
        } else {
          // Server says incomplete — clear local flag regardless of who it belonged to
          setHasCompletedOnboarding(false);
          await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
          await AsyncStorage.removeItem(ONBOARDING_COMPLETE_USER_KEY);
        }

        // Clear stale onboarding context data when a DIFFERENT user needs onboarding
        if (!serverComplete && me?.id) {
          const lastUserId = await AsyncStorage.getItem(LAST_ONBOARDING_USER_KEY);
          if (lastUserId && lastUserId !== me.id) {
            if (__DEV__)
              console.log('[AuthProvider] Different user needs onboarding — clearing stale data');
            await AsyncStorage.multiRemove([
              'onboarding_state',
              'onboarding_progress',
              'onboarding_reducer_state',
            ]);
          }
          await AsyncStorage.setItem(LAST_ONBOARDING_USER_KEY, me.id);
        }

        // NOW set user — routing effect will fire with correct hasCompletedOnboarding
        setUser(me);
        setSentryUser({ id: me.id, email: me.email, username: me.username });
        analytics.identify(me.id, { email: me.email, role: me.role });
        setPendingVerificationEmail(null);

        // Stagger non-critical subscription refresh so auth/bootstrap requests do not fan out at once.
        if (!options?.skipSubscriptionRefresh) {
          if (subscriptionFetchTimeoutRef.current)
            clearTimeout(subscriptionFetchTimeoutRef.current);
          subscriptionFetchTimeoutRef.current = setTimeout(() => {
            subscriptionFetchTimeoutRef.current = null;
            fetchSubscription().catch(e =>
              captureException(e, { tags: { context: 'subscription_fetch' } })
            );
          }, 750);
        }

        // v1.0.2: register push token after successful checkAuth; signOut clears the timeout.
        if (me.preferences?.onboarding_completed === true) {
          if (pushTokenTimeoutRef.current) clearTimeout(pushTokenTimeoutRef.current);
          pushTokenTimeoutRef.current = setTimeout(() => {
            pushTokenTimeoutRef.current = null;
            registerPushTokenRef.current?.().catch(e => {
              if (__DEV__)
                console.warn('[AuthProvider] checkAuth push token register failed:', e?.message);
            });
          }, 500);
        }

        return me;
      } catch (err: any) {
        // Only clear auth state on explicit unauthorized responses.
        // For transient network/server errors, preserve the existing session.
        if (err?.status === 401) {
          setUser(null);
          setSentryUser(null);
          setPendingVerificationEmail(null);
          throw err; // Rethrow 401 so callers (sign-in, sign-up) can handle it
        }
        if (__DEV__)
          console.error('[AuthProvider] checkAuth transient error (session preserved):', err);
        return null; // Don't crash the app on transient network/server errors
      }
    },
    [fetchSubscription]
  );

  const checkAuthRef = React.useRef(checkAuth);
  React.useEffect(() => {
    checkAuthRef.current = checkAuth;
  }, [checkAuth]);

  const redirectWithTelemetry = useCallback(
    (to: string, reason: string, userSnapshot?: AuthUser | null) => {
      const from =
        Array.isArray(segmentsRef.current) && segmentsRef.current.length
          ? segmentsRef.current.join('/')
          : 'index';
      const effectiveUser = userSnapshot ?? user;
      const role =
        String(effectiveUser?.preferences?.role || effectiveUser?.role || '').trim() || null;
      const approvalStatus =
        typeof effectiveUser?.approval_status === 'string' ? effectiveUser.approval_status : null;
      const onboardingCompleted = effectiveUser?.preferences?.onboarding_completed === true;
      const emailVerified = effectiveUser?.email_verified === true;
      const pendingVerification = !!pendingVerificationEmail;
      const paidByOwner = effectiveUser?.paid_by_owner === true;
      const proceedingAsFan = effectiveUser?.preferences?.proceeding_as_fan === true;
      const coachAgreementAccepted = !!effectiveUser?.preferences?.coach_agreement_accepted_at;
      const userStateFingerprint = buildAuthRedirectFingerprint({
        from,
        role,
        approvalStatus,
        onboardingCompleted,
        emailVerified,
        pendingVerification,
        healthOk,
        paidByOwner,
        proceedingAsFan,
        coachAgreementAccepted,
      });

      navigateWithAuthRedirect(router, {
        from,
        to,
        reason,
        userStateFingerprint,
        userId: effectiveUser?.id || null,
        role,
        approvalStatus,
        onboardingCompleted,
        emailVerified,
        pendingVerification,
        healthOk,
        paidByOwner,
        proceedingAsFan,
        coachAgreementAccepted,
      });

      lastRedirectRef.current = to;
    },
    [healthOk, pendingVerificationEmail, router, user]
  );

  const getPendingCoachRoute = useCallback(
    (userSnapshot?: AuthUser | null) => {
      const effectiveUser = userSnapshot ?? user;
      const prefs = effectiveUser?.preferences;

      // Coach join requests and org approval waits have different status screens.
      // Choose the screen from server-backed state so relaunches land consistently.
      if (prefs?.join_request_pending === true) {
        return '/onboarding/pending-approval';
      }
      if (prefs?.organization_id) {
        return '/onboarding/league-pending-approval';
      }
      return '/onboarding/pending-approval';
    },
    [user]
  );

  // Sign out
  const signOut = useCallback(async () => {
    const userBeforeSignOut = user;
    try {
      await auth.logout();
    } catch (error) {
      if (__DEV__) console.warn('[auth] Failed to clear persisted session during sign out:', error);
    } finally {
      if (pushTokenTimeoutRef.current) {
        clearTimeout(pushTokenTimeoutRef.current);
        pushTokenTimeoutRef.current = null;
      }
      if (subscriptionFetchTimeoutRef.current) {
        clearTimeout(subscriptionFetchTimeoutRef.current);
        subscriptionFetchTimeoutRef.current = null;
      }
      clearPostCacheOnLogout();
      setUser(null);
      setSentryUser(null);
      setPendingVerificationEmail(null);
      setHasCompletedOnboarding(false);
      setSubscriptionTier('rookie');
      setHasActiveSubscription(false);
      await AsyncStorage.multiRemove([
        ONBOARDING_COMPLETE_KEY,
        ONBOARDING_COMPLETE_USER_KEY,
        'onboarding_state',
        'onboarding_progress',
        'onboarding_reducer_state',
      ]);
      lastPushRegistrationRef.current = null;
      redirectWithTelemetry('/sign-in', 'sign_out', userBeforeSignOut);
    }
  }, [redirectWithTelemetry, user]);

  const registerPushToken = useCallback(async () => {
    if (!user?.id) return false;
    return setupPushNotifications(user.id);
  }, [setupPushNotifications, user?.id]);

  React.useEffect(() => {
    registerPushTokenRef.current = registerPushToken;
  }, [registerPushToken]);

  const markOnboardingCompleteLocally = useCallback(async () => {
    try {
      setHasCompletedOnboarding(true);
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      if (user?.id) {
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_USER_KEY, user.id);
      }
    } catch (error) {
      if (__DEV__) console.warn('[Auth] Failed to persist onboarding completion flag:', error);
    }
  }, [user?.id]);

  const markOnboardingIncompleteLocally = useCallback(async () => {
    try {
      setHasCompletedOnboarding(false);
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_USER_KEY);
    } catch (error) {
      if (__DEV__) console.warn('[Auth] Failed to clear onboarding completion flag:', error);
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    if (!navReady) {
      if (__DEV__) console.log('[AuthProvider] Waiting for navigation state...');
      return;
    }

    if (__DEV__) console.log('[AuthProvider] Navigation ready, starting auth check');
    let mounted = true;

    (async () => {
      // 0. Clear stale Keychain tokens from previous install (iOS Keychain persists across uninstall)
      const { clearStaleTokensOnFreshInstall } = await import('@/api/auth');
      await clearStaleTokensOnFreshInstall();

      // 1. Check health first
      if (__DEV__) console.log('[AuthProvider] Checking backend health...');
      const healthy = await checkHealth();
      if (__DEV__) console.log('[AuthProvider] Health check result:', healthy);

      if (!mounted) return;

      // 2. If backend is down, we can't authenticate
      if (!healthy) {
        if (__DEV__) console.log('[AuthProvider] Backend unhealthy, stopping initialization');
        setLoading(false);
        setInitializing(false);
        // Don't redirect - let user see offline banner
        return;
      }

      // 3. Check auth status
      if (__DEV__) console.log('[AuthProvider] Checking authentication...');
      try {
        await checkAuthRef.current();
        if (__DEV__) console.log('[AuthProvider] Auth check successful');
      } catch (err: any) {
        if (__DEV__)
          console.log('[AuthProvider] Auth check failed (user not logged in):', err.message);
        // Auth failed - user not logged in
        // Don't redirect here - let the routing logic below handle it
      } finally {
        if (mounted) {
          if (__DEV__) console.log('[AuthProvider] Initialization complete');
          setLoading(false);
          setInitializing(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navReady, checkHealth]);

  // Re-check auth when app comes to foreground (debounced to prevent rapid-fire)
  const lastForegroundCheckRef = React.useRef<number>(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && !initializing) {
        const now = Date.now();
        // Skip if we checked less than 5 seconds ago (prevents infinite loop from rapid foreground events)
        if (now - lastForegroundCheckRef.current < 5000) return;
        lastForegroundCheckRef.current = now;
        checkAuthRef
          .current()
          .catch(e => captureException(e, { tags: { context: 'foreground_auth_refresh' } }));
      }
    });
    return () => {
      subscription.remove();
      if (subscriptionFetchTimeoutRef.current) {
        clearTimeout(subscriptionFetchTimeoutRef.current);
        subscriptionFetchTimeoutRef.current = null;
      }
    };
  }, [fetchSubscription, initializing]);

  // Safety timeout - force initialization complete after 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (initializing) {
        if (__DEV__)
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
        if (__DEV__) console.warn('[Auth] AsyncStorage timeout - assuming onboarding incomplete');
        setHasCompletedOnboarding(false);
      }
    }, 2000);

    (async () => {
      try {
        const [storedValue, storedUserId] = await AsyncStorage.multiGet([
          ONBOARDING_COMPLETE_KEY,
          ONBOARDING_COMPLETE_USER_KEY,
        ]);
        clearTimeout(timeout);
        if (mounted) {
          const flagValue = storedValue[1] === 'true';
          const hasUserId = !!storedUserId[1];
          // Only trust the flag if it has a user ID (will be validated in checkAuth)
          // Flags without a user ID are legacy/stale — ignore them
          setHasCompletedOnboarding(flagValue && hasUserId);
        }
      } catch (error) {
        clearTimeout(timeout);
        if (__DEV__) console.warn('[Auth] Failed to load onboarding flag from storage:', error);
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
      if (__DEV__) console.log('[AuthProvider] Still initializing, skipping routing');
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
      'reset',
      'public-event',
    ]);
    const isPublic = publicRoutes.has(firstSegment);

    if (__DEV__)
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
      if (__DEV__) console.log('[AuthProvider] Backend unhealthy, skipping routing');
      return;
    }

    // If user is awaiting email verification, navigate to verify-email
    if (pendingVerificationEmail && firstSegment !== 'verify-email') {
      // Belt-and-suspenders: if we have a pending email but no user, check the
      // stored token asynchronously. If the token is gone, the verification
      // flow is stale — clear it. setState triggers this effect to re-run,
      // which then falls through to unauthenticated routing (→ /sign-in).
      if (!user) {
        void (async () => {
          const storedToken = await auth.getToken().catch(() => null);
          if (!storedToken) {
            if (__DEV__)
              console.log(
                '[AuthProvider] Stale pendingVerificationEmail — no user or token, clearing'
              );
            setPendingVerificationEmail(null);
          }
        })();
      }
      if (lastRedirectRef.current !== '/verify-email') {
        redirectWithTelemetry('/verify-email', 'pending_verification');
      }
      return;
    }

    // Authenticated routing
    if (user) {
      // If user hasn't verified their email, redirect to verify screen
      // This prevents unverified users from accessing protected features (e.g. creating posts)
      // that the server's requireVerified middleware would reject with 403
      const verifyRoutes = new Set(['verify', 'verify-email', 'verify-identity']);
      if (user.email_verified !== true && !verifyRoutes.has(firstSegment)) {
        if (__DEV__) console.log('[AuthProvider] User email not verified, redirecting to verify');
        if (lastRedirectRef.current !== '/verify') {
          redirectWithTelemetry('/verify', 'email_not_verified');
        }
        return;
      }

      // Approved coach who was browsing as fan — restore coach role and route to coach onboarding.
      // When a coach taps "Continue as Fan", role is saved as 'fan' with proceeding_as_fan=true.
      // Once the org is approved, we must flip them back to coach and send them through agreement.
      if (user.approval_status === 'APPROVED' && user.preferences?.proceeding_as_fan === true) {
        // Fire-and-forget restore (the effect callback is sync, so we can't await).
        // The ref prevents the redirect loop: once the restore is in-flight, we
        // stop kicking off duplicates; the finally block clears the ref and the
        // next effect re-run (triggered by setUser) will see the clean state.
        if (!restoringCoachRef.current) {
          restoringCoachRef.current = true;
          void (async () => {
            try {
              await User.updatePreferences({ proceeding_as_fan: false, role: 'coach' });
              setUser(prev =>
                prev
                  ? {
                      ...prev,
                      preferences: { ...prev.preferences, proceeding_as_fan: false, role: 'coach' },
                    }
                  : prev
              );
            } catch (err: any) {
              if (__DEV__)
                console.warn('[AuthProvider] Failed to restore coach role:', err?.message);
              captureException(err, { tags: { context: 'fan_to_coach_restore' } });
            } finally {
              restoringCoachRef.current = false;
            }
          })();
        }
        // Route to coach-agreement if they haven't accepted it yet — this does not
        // depend on the in-flight restore completing.
        const onAgreement =
          Array.isArray(segmentsRef.current) &&
          segmentsRef.current.join('/').includes('coach-agreement');
        if (!hasCurrentCoachAgreement(user) && !onAgreement) {
          if (__DEV__)
            console.log(
              '[AuthProvider] Approved fan→coach transition — routing to coach agreement'
            );
          if (lastRedirectRef.current !== '/onboarding/coach-agreement') {
            redirectWithTelemetry('/onboarding/coach-agreement', 'approved_fan_to_coach_agreement');
          }
          return;
        }
      }

      // Block unapproved coaches (pending/rejected) on coach path.
      // Unless they chose "Continue as Fan" to use the app while waiting.
      const isUnapprovedCoach =
        (user.approval_status === 'PENDING' || user.approval_status === 'REJECTED') &&
        user.preferences?.role === 'coach';
      const proceedingAsFan =
        user.preferences?.proceeding_as_fan === true && user.approval_status !== 'APPROVED';
      const currentPath = Array.isArray(segmentsRef.current) ? segmentsRef.current.join('/') : '';
      // isPendingCoach is derived from user state, not route string — avoids fragile path matching
      const isPendingCoach = isUnapprovedCoach && !proceedingAsFan;
      // Don't yank pending coaches off onboarding routes (e.g. step-3 during upgrade flow)
      const pendingCoachRoute = getPendingCoachRoute(user);
      if (
        isPendingCoach &&
        lastRedirectRef.current !== pendingCoachRoute &&
        firstSegment !== 'sign-in' &&
        firstSegment !== 'sign-up' &&
        firstSegment !== 'onboarding'
      ) {
        if (__DEV__)
          console.log('[AuthProvider] Unapproved coach blocked — must wait for approval decision');
        if (lastRedirectRef.current !== pendingCoachRoute) {
          redirectWithTelemetry(pendingCoachRoute, 'coach_pending_approval');
        }
        return;
      }

      // SERVER IS SOURCE OF TRUTH for onboarding completion — never trust AsyncStorage alone
      // Treat undefined/null as incomplete (prevents bypass when flag is missing)
      const serverSaysIncomplete = user.preferences?.onboarding_completed !== true;
      const needsOnboarding = serverSaysIncomplete;
      const pendingPlan = String(
        user.preferences?.pending_plan || user.preferences?.plan || ''
      ).toLowerCase();
      const coachNeedsCheckout =
        user.preferences?.role === 'coach' &&
        user.approval_status === 'APPROVED' &&
        user.paid_by_owner !== true &&
        user.preferences?.payment_pending === true &&
        (pendingPlan === 'veteran' || pendingPlan === 'legend') &&
        (user.preferences?.payment_approved === true ||
          user.preferences?.join_request_pending !== true);
      const isOnPaymentPath =
        currentPath.includes('settings/manage-subscription') ||
        currentPath.includes('subscription-paywall') ||
        currentPath.includes('payment-success') ||
        currentPath.includes('billing');

      if (!needsOnboarding && coachNeedsCheckout && !isOnPaymentPath) {
        const now = Date.now();
        const lastPaywallPush = paywallPushTsRef.current || 0;
        if (now - lastPaywallPush < 5000) {
          if (__DEV__)
            console.warn('[AuthProvider] Paywall redirect loop detected — breaking circuit');
          paywallPushTsRef.current = 0;
          return;
        }
        if (__DEV__)
          console.log('[AuthProvider] Approved coach must complete checkout before tools');
        if (lastRedirectRef.current !== '/settings/manage-subscription') {
          paywallPushTsRef.current = now;
          redirectWithTelemetry('/settings/manage-subscription', 'coach_checkout_required');
        }
        return;
      }

      // Approved coach with incomplete onboarding (approved while app was closed)
      // Send to the correct onboarding step — NOT back to pending-approval (causes loop)
      if (
        needsOnboarding &&
        user.approval_status === 'APPROVED' &&
        user.preferences?.role === 'coach' &&
        firstSegment !== 'onboarding'
      ) {
        if (__DEV__)
          console.log('[AuthProvider] Approved coach needs to complete post-approval setup');
        // Check if they have an org yet — if not, send to league step; if yes, send to create-team
        const hasOrg = !!user.preferences?.organization_id;
        const target = hasOrg ? '/(tabs)/create-team' : '/onboarding/step-3-league';
        if (lastRedirectRef.current !== target) {
          redirectWithTelemetry(target, 'approved_coach_post_approval_setup');
        }
        return;
      }

      // Approved coaches must accept the Coach Agreement before accessing tools
      const isCoachWithoutAgreement =
        !needsOnboarding &&
        user.preferences?.role === 'coach' &&
        user.approval_status === 'APPROVED' &&
        !hasCurrentCoachAgreement(user) &&
        !coachNeedsCheckout;
      const isOnAgreementScreen = currentPath.includes('coach-agreement');
      if (isCoachWithoutAgreement && !isOnAgreementScreen) {
        if (lastRedirectRef.current !== '/onboarding/coach-agreement') {
          redirectWithTelemetry('/onboarding/coach-agreement', 'coach_agreement_required');
        }
        return;
      }

      // If needs onboarding and not already there, redirect to start onboarding
      if (needsOnboarding && firstSegment !== 'onboarding') {
        if (__DEV__) console.log('[AuthProvider] User needs onboarding, redirecting to step 1');
        if (lastRedirectRef.current !== '/onboarding/step-1-role') {
          redirectWithTelemetry('/onboarding/step-1-role', 'onboarding_required');
        }
        return;
      }

      // If onboarding is complete and user is still on onboarding route, send to main app.
      // Exception: pending-approval and league-pending-approval are completion screens —
      // the user must tap the button themselves. Don't yank them away automatically.
      // Exception: coach-agreement — only keep the user there if they still need to accept it.
      const isOnPendingScreen =
        currentPath.includes('pending-approval') || currentPath.includes('league-pending-approval');
      if (
        !needsOnboarding &&
        firstSegment === 'onboarding' &&
        !isPendingCoach &&
        !isOnPendingScreen &&
        !(isOnAgreementScreen && isCoachWithoutAgreement)
      ) {
        if (__DEV__)
          console.log('[AuthProvider] User completed onboarding, redirecting to main app');
        const landingRoute = '/(tabs)';
        if (lastRedirectRef.current !== landingRoute) {
          redirectWithTelemetry(landingRoute, 'onboarding_complete');
        }
        return;
      }

      // Payment redirect screens must stay mounted long enough to reconcile
      // webhook/finalize-session state. Redirecting an authenticated user away
      // from /payment-success or /payment-cancel causes a bounce back into
      // paywall logic before Stripe state is finalized.
      const isPaymentRedirectScreen =
        firstSegment === 'payment-success' || firstSegment === 'payment-cancel';

      // If on public route and doesn't need onboarding (but NOT verify-email or payment redirects)
      if (
        isPublic &&
        !needsOnboarding &&
        firstSegment !== 'verify-email' &&
        !isPaymentRedirectScreen
      ) {
        const landingRoute = '/(tabs)';
        if (lastRedirectRef.current !== landingRoute) {
          redirectWithTelemetry(landingRoute, 'public_route_authenticated');
        }
        return;
      }

      // SECURITY: Flush any pending deep link now that auth is settled and user is valid.
      // Deep links to protected screens (post, game, team, profile) are deferred in
      // _layout.tsx until we reach this point — preventing unauthenticated access.
      if (!needsOnboarding) {
        const pendingUrl = consumePendingDeepLink();
        if (pendingUrl) {
          if (__DEV__) console.log('[AuthProvider] Flushing deferred deep link:', pendingUrl);
          handleDeepLink(pendingUrl);
          return;
        }
      }
    }

    // Unauthenticated routing
    if (!user && !pendingVerificationEmail && !isPublic) {
      if (lastRedirectRef.current !== '/sign-in') {
        if (__DEV__) console.log('[AuthProvider] Redirecting to sign-in (unauthenticated)');
        redirectWithTelemetry('/sign-in', 'unauthenticated');
      }
    }
    // NOTE: `segments` is intentionally excluded — we read segmentsRef.current inside.
    // Including segments causes an infinite loop: route change -> segments update -> effect re-runs -> route change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    pendingVerificationEmail,
    initializing,
    healthOk,
    router,
    hasCompletedOnboarding,
    redirectWithTelemetry,
    getPendingCoachRoute,
  ]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      pendingVerificationEmail,
      loading,
      healthOk,
      healthError,
      isAdmin,
      subscriptionTier,
      hasActiveSubscription,
      checkAuth,
      signOut,
      registerPushToken,
      markOnboardingCompleteLocally,
      markOnboardingIncompleteLocally,
    }),
    [
      user,
      pendingVerificationEmail,
      loading,
      healthOk,
      healthError,
      isAdmin,
      subscriptionTier,
      hasActiveSubscription,
      checkAuth,
      signOut,
      registerPushToken,
      markOnboardingCompleteLocally,
      markOnboardingIncompleteLocally,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
