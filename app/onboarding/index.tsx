import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function OnboardingIndex() {
  const router = useRouter();
  useEffect(() => { 
    // Start with role selection
    router.replace('/onboarding/step-1-role'); 
  }, []);
  return null;
}

