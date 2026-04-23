import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import { STEP_ROUTES, nextIncompleteStep } from '@/context/onboardingReducer';
import { getPendingCoachRoute } from '@/utils/roleChecks';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';

export default function OnboardingIndex() {
  const router = useRouter();
  const { user } = useAuth();
  const { progress, state, isLoaded, setProgress, reducerState: _reducerState, dispatch, nextStep: _nextStep, hydrateFromServer } = useOnboarding();
  const [hasNavigated, setHasNavigated] = useState(false);
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
    // Fire-and-forget: navigation proceeds immediately; state update is async.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      User.me().then((me: any) => {
        if (me?.preferences && Object.keys(me.preferences).length > 0) {
          hydrateFromServer(me.preferences);
        }
      }).catch((err: any) => {
        console.warn('[onboarding] Failed to sync server preferences:', err?.message || err);
      });
    }
  }, [user, isLoaded, router, hydrateFromServer]);
  
  useEffect(() => {
    // Don't navigate until AsyncStorage has loaded and user is authenticated
    if (!isLoaded || hasNavigated || !user) {
      return;
    }

    // Route to the first incomplete step based on actual field-level completion checks.
    // Previously hardcoded `state?.role ? 1 : 0` which always sent returning coaches to step 2.
    const role = state?.role as 'fan' | 'coach' | undefined;
    const calculatedStepIndex = nextIncompleteStep(state, role);

    const serverComplete = user.preferences?.onboarding_completed === true;

    // Only the server can declare onboarding complete. Local draft state can have
    // all required fields while the completion call is still pending/failed.
    // Treating draft completeness as "done" kicks users to /(tabs), after which
    // AuthProvider sends them back into onboarding and creates a loop.
    const allComplete = role === 'coach'
      ? (!!state?.role && !!state?.step_2_visited && !!(state?.join_request_pending || state?.organization_id))
      : (!!state?.role && !!state?.step_2_visited);
    if (serverComplete && allComplete) {
      setHasNavigated(true);
      router.replace('/(tabs)' as any);
      return;
    }

    if (!serverComplete && role === 'coach' && allComplete) {
      setHasNavigated(true);
      router.replace(
        getPendingCoachRoute({
          preferences: {
            join_request_pending: state?.join_request_pending,
            organization_id: state?.organization_id,
          },
        }) as any
      );
      return;
    }

    const targetRoute = STEP_ROUTES[calculatedStepIndex] || STEP_ROUTES[0];

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[ONBOARDING INDEX] Navigation decision:', {
        role: state?.role,
        progress,
        calculatedStepIndex,
        targetRoute,
        hasStep2: !!(state?.username && state?.dob && (state?.zip || state?.zip_code)),
        hasStep3: !!state?.plan,
        hasStep4: !!(state?.team_id || state?.organization_id),
      });
    }

    // Sync progress with calculated step
    if (calculatedStepIndex !== progress) {
      setProgress(calculatedStepIndex);
      dispatch({ type: 'SET_STEP', stepIndex: calculatedStepIndex, reason: 'INDEX_ROUTER' });
    }

    setHasNavigated(true);
    router.replace(targetRoute as any);
    // Only re-run when loading completes, user changes, or onboarding state changes
    // Exclude progress/setProgress/dispatch to avoid infinite re-render loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNavigated, isLoaded, state, user, router]);
  
  // Show loading indicator while waiting for state to load
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
