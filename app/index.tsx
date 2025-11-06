import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';

export default function Index() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      try {
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const me: any = await Promise.race([User.me(), timeoutPromise]);
        
        if (me) {
          // User is logged in
          const needsOnboarding = me?.preferences && (me.preferences.onboarding_completed === false);
          
          if (needsOnboarding) {
            router.replace('/onboarding/step-2-basic');
          } else {
            // Everyone lands on feed
            router.replace('/(tabs)/feed' as any);
          }
        } else {
          // No user, go to sign in
          router.replace('/sign-in');
        }
      } catch (err: any) {
        // Error getting user or timeout, go to sign in
        console.log('Error checking auth:', err.message);
        router.replace('/sign-in');
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
