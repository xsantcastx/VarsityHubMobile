import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { loading, user } = useAuth();
  const router = useRouter();
  
  // Fallback: if AuthProvider doesn't redirect within 3 seconds, do it manually
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('[Index] ⚠️ Fallback timeout - manually redirecting');
      if (!user) {
        console.log('[Index] Redirecting to sign-in (no user)');
        router.replace('/sign-in');
      } else if (user.preferences?.onboarding_completed === false) {
        console.log('[Index] Redirecting to onboarding');
        router.replace('/onboarding/step-1-role');
      } else {
        console.log('[Index] Redirecting to main app');
        router.replace('/(tabs)' as any);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [user, router]);
  
  // AuthProvider handles all routing logic
  // This screen shows loading state while AuthProvider determines where to navigate
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
