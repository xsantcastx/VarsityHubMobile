import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/ui/PrimaryButton';

function PaymentCancelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const isAd = params.type === 'ad';
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const adAccentColor = colorScheme === 'dark' ? '#FBBF24' : '#92400E';
  const adIconColor = colorScheme === 'dark' ? '#FBBF24' : '#F59E0B';

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
      <Stack.Screen
        options={{
          title: isAd ? 'Checkout Cancelled' : 'Payment Cancelled',
          headerShown: false,
          gestureEnabled: true,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          <View style={[styles.contentInner, isLargeScreen && styles.contentInnerLarge]}>
            <View style={styles.cancelContainer}>
              <MaterialIcons
                name="cancel"
                size={72}
                color={isAd ? adIconColor : theme.destructive}
              />
              <Text
                style={[styles.cancelTitle, { color: isAd ? adAccentColor : theme.destructive }]}
              >
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
                  <Pressable
                    style={[styles.secondaryButton, { borderColor: theme.border }]}
                    onPress={handleContinue}
                  >
                    <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                      Continue with Free Version
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
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
  contentInner: {
    width: '100%',
    alignSelf: 'center',
  },
  contentInnerLarge: {
    maxWidth: 560,
  },
  cancelContainer: {
    alignItems: 'center',
    width: '100%',
  },
  cancelTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  cancelText: {
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
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
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PaymentCancelScreen;
