import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { User } from '@/api/entities';
import PrimaryButton from '@/ui/PrimaryButton';

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string; type?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionVerified, setSessionVerified] = useState(false);
  
  // Check if this is an ad payment (type=ad) or subscription payment
  const isAdPayment = params.type === 'ad';

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        if (params.session_id) {
          // Verify the payment was successful by checking user status
          const me = await User.me();
          if (me?.preferences?.payment_pending === false) {
            setSessionVerified(true);
          }
        }
      } catch (err: any) {
        setError('Unable to verify payment status');
        console.error('Payment verification error:', err);
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [params.session_id]);

  const handleContinue = () => {
    // Navigate to the appropriate next step based on payment type
    if (isAdPayment) {
      router.replace('/my-ads'); // Redirect to My Ads screen after ad payment
    } else {
      router.replace('/(tabs)/feed'); // Redirect to feed after subscription payment
    }
  };

  const handleRetryVerification = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const me = await User.me();
      if (me?.preferences?.payment_pending === false) {
        setSessionVerified(true);
      } else {
        setError('Payment verification still pending. Please try again in a moment.');
      }
    } catch (err: any) {
      setError('Unable to verify payment status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ 
        title: 'Payment Successful',
        headerShown: true,
        gestureEnabled: false,
        headerLeft: () => null
      }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Verifying payment...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={64} color="#DC2626" />
              <Text style={styles.errorTitle}>Verification Issue</Text>
              <Text style={styles.errorText}>{error}</Text>
              <View style={styles.buttonContainer}>
                <PrimaryButton 
                  label="Try Again" 
                  onPress={handleRetryVerification}
                />
              </View>
              <View style={styles.buttonContainer}>
                <Pressable 
                  onPress={handleContinue}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Continue to App</Text>
                </Pressable>
              </View>
            </View>
          ) : sessionVerified ? (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
              <Text style={styles.successTitle}>Payment Successful!</Text>
              <Text style={styles.successText}>
                {isAdPayment 
                  ? 'Your ad payment has been processed successfully. Your ad is now active!'
                  : 'Your subscription has been activated. You can now access all premium features.'}
              </Text>
              <View style={styles.buttonContainer}>
                <PrimaryButton 
                  label={isAdPayment ? "View My Ads" : "Continue to App"}
                  onPress={handleContinue}
                />
              </View>
            </View>
          ) : (
            <View style={styles.pendingContainer}>
              <Ionicons name="time-outline" size={64} color="#F59E0B" />
              <Text style={styles.pendingTitle}>Payment Processing</Text>
              <Text style={styles.pendingText}>
                Your payment is being processed. This may take a few moments.
              </Text>
              <View style={styles.buttonContainer}>
                <PrimaryButton 
                  label="Check Status" 
                  onPress={handleRetryVerification}
                />
              </View>
              <View style={styles.buttonContainer}>
                <Pressable 
                  onPress={handleContinue}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Continue to App</Text>
                </Pressable>
              </View>
            </View>
          )}
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
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#16A34A',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  pendingContainer: {
    alignItems: 'center',
  },
  pendingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  pendingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    width: '100%',
    marginBottom: 12,
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
  },
});