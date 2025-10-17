import { useOnboarding } from '@/context/OnboardingContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function OnboardingIndex() {
  const router = useRouter();
  const { progress } = useOnboarding();
  
  useEffect(() => { 
    // Resume from saved progress, or start at step 1
    const stepRoutes = [
      '/onboarding/step-1-role',
      '/onboarding/step-2-basic',
      '/onboarding/step-3-plan',
      '/onboarding/step-4-season',
      '/onboarding/step-5-league',
      '/onboarding/step-6-authorized-users',
      '/onboarding/step-7-profile',
      '/onboarding/step-8-interests',
      '/onboarding/step-9-features',
      '/onboarding/step-10-confirmation',
    ];
    
    // If progress is set and valid, resume from that step
    // Otherwise start from the beginning
    const targetRoute = (progress > 0 && progress < stepRoutes.length) 
      ? stepRoutes[progress] 
      : stepRoutes[0];
    
    router.replace(targetRoute as any);
  }, [progress]);
  
  return null;
}

