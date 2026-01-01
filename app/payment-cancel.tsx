import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/ui/PrimaryButton';

export default function PaymentCancelScreen() {
  const router = useRouter();

  const handleRetryPayment = () => {
    // Navigate back to the subscription selection
    router.replace('/onboarding/step-3-plan');
  };

  const handleContinue = () => {
    // Navigate to feed (they can try payment later)
    router.replace('/(tabs)/feed');
  };

  return (
    <>
      <Stack.Screen options={{ 
        title: 'Payment Cancelled',
        headerShown: true,
        gestureEnabled: true
      }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.cancelContainer}>
            <Ionicons name="close-circle-outline" size={64} color="#DC2626" />
            <Text style={styles.cancelTitle}>Payment Cancelled</Text>
            <Text style={styles.cancelText}>
              Your payment was cancelled. You can try again or continue with limited features.
            </Text>
            
            <View style={styles.buttonContainer}>
              <PrimaryButton 
                label="Try Payment Again" 
                onPress={handleRetryPayment}
              />
            </View>
            
            <View style={styles.buttonContainer}>
              <Pressable style={styles.secondaryButton} onPress={handleContinue}>
                <Text style={styles.secondaryButtonText}>
                  Continue with Free Version
                </Text>
              </Pressable>
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
