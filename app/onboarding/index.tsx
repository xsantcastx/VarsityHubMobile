import { useOnboarding } from '@/context/OnboardingContext';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function OnboardingIndex() {
  const router = useRouter();
  const { progress, state, isLoaded } = useOnboarding();
  const [hasNavigated, setHasNavigated] = useState(false);
  
  useEffect(() => { 
    // Don't navigate until AsyncStorage has loaded
    if (!isLoaded || hasNavigated) {
      return;
    }
    
    // Resume from saved progress, or start at step 1
    const stepRoutes = [
      '/onboarding/step-1-role',           // 0
      '/onboarding/step-2-basic',          // 1
      '/onboarding/step-3-plan',           // 2
      '/onboarding/step-4-organization',   // 3
      '/onboarding/step-5-teams',          // 4
      '/onboarding/step-6-authorized-users', // 5
      '/onboarding/step-7-profile',        // 6
      '/onboarding/step-8-interests',      // 7
      '/onboarding/step-9-features',       // 8
      '/onboarding/step-10-confirmation',  // 9
    ];
    
    // Progress is 0-based index, so progress=8 means step 10
    const targetRoute = stepRoutes[progress] || stepRoutes[0];
    
    
    setHasNavigated(true);
    router.replace(targetRoute as any);
  }, [hasNavigated, isLoaded, progress, router, state]);
  
  // Show loading indicator while waiting for state to load
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
