import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import { STEP_ROUTES, nextIncompleteStep } from '@/context/onboardingReducer';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function OnboardingIndex() {
  const router = useRouter();
  const { user } = useAuth();
  const { progress, state, isLoaded, setProgress, reducerState, dispatch, nextStep } = useOnboarding();
  const [hasNavigated, setHasNavigated] = useState(false);

  // CRITICAL: User must be authenticated to access onboarding
  useEffect(() => {
    if (!isLoaded) return;
    
    if (!user) {
      if (__DEV__) console.warn('[Onboarding] Unauthenticated user trying to access onboarding - redirecting to sign-in');
      router.replace('/sign-in');
      return;
    }
  }, [user, isLoaded, router]);
  
  useEffect(() => {
    // Don't navigate until AsyncStorage has loaded and user is authenticated
    if (!isLoaded || hasNavigated || !user) {
      return;
    }

    // Use reducer-based deterministic step calculation
    const calculatedStepIndex = nextIncompleteStep(state, state?.role);
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
