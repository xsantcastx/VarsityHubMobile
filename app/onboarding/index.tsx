import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getOnboardingIndexRouteDecision } from '@/utils/appRouteDecisions';
import { getFreshAuthSnapshot } from '@/utils/authState';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { captureException } from '@/utils/sentry';

export default function OnboardingIndex() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const router = useRouter();
  const { user, checkAuth } = useAuth();
  const { progress, state, isLoaded, setProgress, reducerState: _reducerState, dispatch, nextStep: _nextStep, hydrateFromServer } = useOnboarding();
  const [hasNavigated, setHasNavigated] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // CRITICAL: User must be authenticated to access onboarding
  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      if (__DEV__) console.warn('[Onboarding] Unauthenticated user trying to access onboarding - redirecting to sign-in');
      router.replace('/sign-in');
      return;
    }

    // Sync server preferences into local state — DB wins over stale AsyncStorage on conflict.
    // Navigation effect waits on hasHydrated so the routing decision sees the
    // server-truth, not stale AsyncStorage. Without this, a returning coach with
    // server preferences.onboarding_completed=true but locally-empty role would
    // get sent to step 0, then AuthProvider would re-route them back into
    // onboarding — silent loop.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      getFreshAuthSnapshot(checkAuth, user)
        .then((me: any) => {
          if (me?.preferences && Object.keys(me.preferences).length > 0) {
            hydrateFromServer(me.preferences);
          }
        })
        .catch((err: any) => {
          // Hydration failure means the navigation effect (below) routes
          // off stale AsyncStorage. For most users this is fine; for the
          // returning-coach edge case where local state diverges from
          // server, it can cause a brief routing flicker
          // (onboarding → /(tabs) → onboarding). We unblock navigation
          // anyway in .finally to avoid spinner-stranding when offline,
          // but capture the failure so we can see how often it actually
          // happens in production.
          console.warn('[onboarding] Failed to sync server preferences:', err?.message || err);
          captureException(err instanceof Error ? err : new Error(String(err)), {
            tags: { context: 'onboarding_hydration_failed' },
          });
        })
        .finally(() => {
          // .finally so a hydration failure (offline, 5xx) still unblocks
          // navigation rather than stranding the user on the spinner forever.
          // The decision then falls back to whatever's in local state — which
          // is the same place we'd have started without this guard.
          setHasHydrated(true);
        });
    }
  }, [checkAuth, user, isLoaded, router, hydrateFromServer]);

  useEffect(() => {
    // Don't navigate until AsyncStorage has loaded, user is authenticated, AND
    // server-side preferences have been merged (or hydration has failed).
    if (!isLoaded || hasNavigated || !user || !hasHydrated) {
      return;
    }

    const decision = getOnboardingIndexRouteDecision(user, state);

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[ONBOARDING INDEX] Navigation decision:', {
        kind: decision.kind,
        role: state?.role,
        progress,
        calculatedStepIndex: decision.stepIndex,
        targetRoute: decision.route,
        hasStep2: !!(state?.username && state?.dob && (state?.zip || state?.zip_code)),
        hasStep3: !!state?.plan,
        hasStep4: !!(state?.team_id || state?.organization_id),
      });
    }

    // Sync progress with calculated step
    if (typeof decision.stepIndex === 'number' && decision.stepIndex !== progress) {
      setProgress(decision.stepIndex);
      dispatch({ type: 'SET_STEP', stepIndex: decision.stepIndex, reason: 'INDEX_ROUTER' });
    }

    setHasNavigated(true);
    router.replace(decision.route as any);
    // Only re-run when loading completes, user changes, or onboarding state changes
    // Exclude progress/setProgress/dispatch to avoid infinite re-render loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNavigated, isLoaded, state, user, router, hasHydrated]);
  
  // Show loading indicator while waiting for state to load
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.background }}>
      <ActivityIndicator size="large" color={palette.tint} />
    </View>
  );
}
