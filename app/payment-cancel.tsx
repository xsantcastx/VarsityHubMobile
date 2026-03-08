import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/ui/PrimaryButton';

export default function PaymentCancelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const isAd = params.type === 'ad';

  // For ad cancellations, auto-navigate back after a short delay
  useEffect(() => {
    if (isAd) {
      const timer = setTimeout(() => {
        if (router.canGoBack()) router.back();
        else router.push('/(tabs)/my-ads');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAd, router]);

  const handleRetryPayment = () => {
    if (isAd) {
      // Go back to ad calendar with selections preserved
      if (router.canGoBack()) router.back();
      else router.push('/(tabs)/my-ads');
    } else {
      router.replace('/onboarding/step-3-plan');
    }
  };

  const handleContinue = () => {
    if (router.canGoBack()) router.back(); else router.push('/(tabs)');
  };

  return (
    <>
      <Stack.Screen options={{
        title: isAd ? 'Checkout Cancelled' : 'Payment Cancelled',
        headerShown: false,
        gestureEnabled: true
      }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.cancelContainer}>
            <MaterialIcons name="cancel" size={64} color={isAd ? '#F59E0B' : '#DC2626'} />
            <Text style={[styles.cancelTitle, isAd && { color: '#92400E' }]}>
              {isAd ? 'Checkout Cancelled' : 'Payment Cancelled'}
            </Text>
            <Text style={styles.cancelText}>
              {isAd
                ? 'No charge was made. Returning to your schedule...'
                : 'Your payment was cancelled. You can try again or continue with limited features.'}
            </Text>

            <View style={styles.buttonContainer}>
              <PrimaryButton
                label={isAd ? 'Back to Schedule' : 'Try Payment Again'}
                onPress={handleRetryPayment}
              />
            </View>

            {!isAd && (
              <View style={styles.buttonContainer}>
                <Pressable style={styles.secondaryButton} onPress={handleContinue}>
                  <Text style={styles.secondaryButtonText}>Continue with Free Version</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cancelContainer: {
    alignItems: 'center',
  },
  cancelTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
});
