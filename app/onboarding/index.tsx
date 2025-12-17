import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import { getOnboardingRouteForProgress } from '@/constants/onboarding';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function OnboardingIndex() {
  const router = useRouter();
  const { user } = useAuth();
  const { progress, state, isLoaded } = useOnboarding();
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
    const targetRoute = getOnboardingRouteForProgress(progress);
    
    
    setHasNavigated(true);
    router.replace(targetRoute as any);
  }, [hasNavigated, isLoaded, progress, router, state, user]);
  
  // Show loading indicator while waiting for state to load
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
