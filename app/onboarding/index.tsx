import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function OnboardingIndex() {
  const router = useRouter();
  const { user } = useAuth();
  const { progress, state, isLoaded, setProgress } = useOnboarding();
  const [hasNavigated, setHasNavigated] = useState(false);

  // CRITICAL: User must be authenticated to access onboarding
  useEffect(() => {
    if (!isLoaded) return;
    
    if (!user) {
      console.warn('[Onboarding] Unauthenticated user trying to access onboarding - redirecting to sign-in');
      router.replace('/sign-in');
      return;
    }
  }, [user, isLoaded, router]);
  
  useEffect(() => { 
    // Don't navigate until AsyncStorage has loaded and user is authenticated
    if (!isLoaded || hasNavigated || !user) {
      return;
    }
    
    const stepRoutes = [
      '/onboarding/step-1-role',           // 0
      '/onboarding/step-2-basic',          // 1
      '/onboarding/step-3-plan',           // 2
      '/onboarding/step-4-organization',   // 3
      '/onboarding/step-6-authorized-users', // 4
      '/onboarding/step-7-profile',        // 5
      '/onboarding/step-8-interests',      // 6
      '/onboarding/step-9-features',       // 7
      '/onboarding/step-10-confirmation',  // 8
    ];
    
    // CRITICAL: For coaches, VALIDATE FIRST before any navigation
    // NEVER allow coaches to reach step 7+ without completing steps 2-6
    if (state?.role === 'coach') {
      if (__DEV__) console.log('[COACH ONBOARDING INDEX] 🔍 Coach detected, validating steps...');
      if (__DEV__) console.log('[COACH ONBOARDING INDEX] Current progress:', progress);
      if (__DEV__) console.log('[COACH ONBOARDING INDEX] Current state:', JSON.stringify(state, null, 2));

      // Force validation - check what step they should be on
      const hasStep2 = !!(state.username && state.dob && (state.zip || state.zip_code));
      const hasStep3 = !!state.plan;
      const hasStep4 = !!(state.team_id || state.organization_id);

      if (__DEV__) console.log('[COACH ONBOARDING INDEX] Step validation:', { hasStep2, hasStep3, hasStep4 });

      // If missing ANY required step, force to first incomplete step
      if (!hasStep2) {
        if (__DEV__) console.log('[COACH ONBOARDING INDEX] ⚠️ Missing Step 2 - redirecting');
        setProgress(1);
        setHasNavigated(true);
        router.replace('/onboarding/step-2-basic');
        return;
      }
      if (!hasStep3) {
        if (__DEV__) console.log('[COACH ONBOARDING INDEX] ⚠️ Missing Step 3 - redirecting');
        setProgress(2);
        setHasNavigated(true);
        router.replace('/onboarding/step-3-plan');
        return;
      }
      if (!hasStep4) {
        if (__DEV__) console.log('[COACH ONBOARDING INDEX] ⚠️ Missing Step 4 - redirecting');
        setProgress(3);
        setHasNavigated(true);
        router.replace('/onboarding/step-4-organization');
        return;
      }

      // If all required steps complete, ensure progress doesn't skip step 6
      if (hasStep2 && hasStep3 && hasStep4) {
        // If progress jumped past step 6 (authorized-users), force back to step 6
        // Step 6 is at index 4 in stepRoutes
        if (progress > 4) {
          if (__DEV__) console.log('[COACH ONBOARDING INDEX] ⚠️ Progress > 4, forcing to Step 6');
          // They're past step 6, but we want to make sure they went through it
          // Force them to step 6 first
          setProgress(4);
          setHasNavigated(true);
          router.replace('/onboarding/step-6-authorized-users');
          return;
        }
        // Progress is at or before step 6, allow normal flow
        const targetRoute = stepRoutes[progress] || stepRoutes[0];
        if (__DEV__) console.log('[COACH ONBOARDING INDEX] ✅ All checks passed, navigating to:', targetRoute);
        setHasNavigated(true);
        router.replace(targetRoute as any);
        return;
      }
    }
    
    // For non-coaches or after validation, resume from saved progress
    const targetRoute = stepRoutes[progress] || stepRoutes[0];
    
    setHasNavigated(true);
    router.replace(targetRoute as any);
  }, [hasNavigated, isLoaded, progress, router, state, user, setProgress]);
  
  // Show loading indicator while waiting for state to load
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
