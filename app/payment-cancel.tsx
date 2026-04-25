import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/ui/PrimaryButton';

function PaymentCancelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const isAd = params.type === 'ad';
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // For ad cancellations, auto-navigate to /my-ads after a short delay.
  // Use router.replace explicitly (not safeGoBack) so the destination is
  // deterministic — if the user happened to navigate during the 1.5s
  // window, safeGoBack would unwind to an unexpected stack frame
  // instead of landing on /my-ads.
  useEffect(() => {
    if (isAd) {
      const timer = setTimeout(() => {
        router.replace('/my-ads' as any);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAd, router]);

  const handleRetryPayment = () => {
    if (isAd) {
      // Go back to ad calendar with selections preserved
      safeGoBack(router, '/my-ads');
    } else {
      router.replace('/subscription-paywall');
    }
  };

  const handleContinue = () => {
    safeGoBack(router);
  };

  return (
    <>
      <Stack.Screen options={{
        title: isAd ? 'Checkout Cancelled' : 'Payment Cancelled',
        headerShown: false,
        gestureEnabled: true
      }} />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          <View style={styles.cancelContainer}>
            <MaterialIcons name="cancel" size={64} color={isAd ? '#F59E0B' : theme.destructive} />
            <Text style={[styles.cancelTitle, { color: theme.destructive }, isAd && { color: '#92400E' }]}>
              {isAd ? 'Checkout Cancelled' : 'Payment Cancelled'}
            </Text>
            <Text style={[styles.cancelText, { color: theme.mutedText }]}>
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
                <Pressable style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={handleContinue}>
                  <Text style={[styles.secondaryButtonText, { color: theme.mutedText }]}>Continue with Free Version</Text>
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
    color: Colors.light.mutedText,
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
    color: Colors.light.mutedText,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PaymentCancelScreen;
