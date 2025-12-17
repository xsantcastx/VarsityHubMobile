import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { user } = useAuth();
  const router = useRouter();
  const e2eMode = String(process.env.EXPO_PUBLIC_E2E || '').trim() === '1';
  
  // Fallback: if AuthProvider doesn't redirect within 3 seconds, do it manually
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (e2eMode) return;

      if (!user) {
        router.replace('/sign-in');
      } else if (user.preferences?.onboarding_completed === false) {
        router.replace('/onboarding/step-1-role');
      } else {
        router.replace('/(tabs)' as any);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [user, router, e2eMode]);
  
  // AuthProvider handles all routing logic
  // This screen shows loading state while AuthProvider determines where to navigate
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
