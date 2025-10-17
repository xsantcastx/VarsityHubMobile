import { useOnboarding } from '@/context/OnboardingContext';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function OnboardingIndex() {
  const router = useRouter();
  const { progress, state } = useOnboarding();
  const [hasNavigated, setHasNavigated] = useState(false);
  
  // Log initial values
  useEffect(() => {
    console.log('[OnboardingIndex] Initial mount - Progress:', progress, 'State keys:', Object.keys(state));
  }, []);
  
  useEffect(() => { 
    if (hasNavigated) return;
    
    // Add a small delay to ensure AsyncStorage has loaded
    const timer = setTimeout(() => {
      // Resume from saved progress, or start at step 1
      const stepRoutes = [
        '/onboarding/step-1-role',           // 0
        '/onboarding/step-2-basic',          // 1
        '/onboarding/step-3-plan',           // 2
        '/onboarding/step-4-season',         // 3
        '/onboarding/step-5-league',         // 4
        '/onboarding/step-6-authorized-users', // 5
        '/onboarding/step-7-profile',        // 6
        '/onboarding/step-8-interests',      // 7
        '/onboarding/step-9-features',       // 8
        '/onboarding/step-10-confirmation',  // 9
      ];
      
      // Progress is 0-based index, so progress=9 means step 10
      const targetRoute = stepRoutes[progress] || stepRoutes[0];
      
      console.log('[OnboardingIndex] Navigating to:', targetRoute, 'Progress:', progress, 'State:', JSON.stringify(state).substring(0, 200));
      
      setHasNavigated(true);
      router.replace(targetRoute as any);
    }, 100); // Small delay to ensure context is loaded
    
    return () => clearTimeout(timer);
  }, [progress, hasNavigated]);
  
  // Show loading indicator while waiting for state to load
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

