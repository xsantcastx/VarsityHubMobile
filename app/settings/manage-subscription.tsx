import { Subscriptions, User } from '@/api/entities';
// @ts-ignore
import { httpPost } from '@/api/http';
import { Button } from '@/components/ui/button';
import { useFocusEffect } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { usePaymentSheet } from '@stripe/stripe-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

export default function ManageSubscription() {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function finalizeWithRetry(sessionId: string, attempts: number = 5, delayMs: number = 2000) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res: any = await Subscriptions.finalizeSession(sessionId);
      if (!res?.pending) return true;
    } catch (err) {
      console.warn('Finalize session attempt failed', err);
    }
    if (attempt < attempts - 1) await wait(delayMs);
  }
  return false;
}


  const refreshPlan = useCallback(async () => {
    try {
      const me: any = await User.me();
      const prefs = me?.preferences || {};
      setPlan(prefs.plan || null);
    } catch (error) {
      console.warn('[manage-subscription] Failed to load plan:', error);
      // Non-critical - plan display can fail silently
    }
  }, []);

  useEffect(() => {
    void refreshPlan();
  }, [refreshPlan]);

  useFocusEffect(
    useCallback(() => {
      void refreshPlan();
      return undefined;
    }, [refreshPlan])
  );

  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();

  const onSubscribe = async (targetPlan: 'veteran' | 'legend') => {
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Not available on iOS',
        'Paid coach plan upgrades are currently unavailable in the iOS app.',
      );
      return;
    }
    setLoading(true);
    try {
      const res: any = await httpPost('/payments/create-payment-sheet', { plan: targetPlan });
      if (res?.paymentIntent) {
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: res.paymentIntent,
          customerEphemeralKeySecret: res.ephemeralKey,
          customerId: res.customer,
          merchantDisplayName: 'Varsity Hub',
        });
        if (initError) {
          Alert.alert('Error', initError.message);
          return;
        }
        const { error } = await presentPaymentSheet();
        if (error) {
          if (error.code !== 'Canceled') Alert.alert('Payment Failed', error.message);
          return;
        }
        // Payment succeeded — try to finalize
        if (res.subscriptionId) {
          const finalized = await finalizeWithRetry(res.subscriptionId);
          if (!finalized) {
            console.warn('Subscription finalize pending after retries', { subscriptionId: res.subscriptionId });
          }
        }
        await refreshPlan();
      } else if (res?.free) {
        Alert.alert('Subscribed', 'Your plan is now active.');
        await refreshPlan();
      } else {
        Alert.alert('Error', 'Unable to start checkout.');
      }
    } catch (e: any) {
      // If email is unverified the server will return 403 — surface a helpful action
      if (e && e.status === 403) {
        Alert.alert(
          'Email verification required',
          'You must verify your email before purchasing a plan.',
          [
            { text: 'Resend verification', onPress: async () => { try { await User.requestVerification(); Alert.alert('Verification sent', 'Check your email for a verification link.'); } catch (error) { console.error('[manage-subscription] Failed to resend verification:', error); Alert.alert('Error', 'Unable to resend verification.'); } } },
            { text: 'OK', style: 'cancel' },
          ]
        );
      } else {
        const raw = e?.data?.error || e?.message || '';
        const safeMsg = /prod_|price_/i.test(raw) ? 'Subscription failed. Please try again or contact support.' : (raw || 'Subscription failed');
        Alert.alert('Error', safeMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onCancel = async () => {
    setLoading(true);
    try {
      const res: any = await Subscriptions.cancel();
      if (res?.ok) {
        Alert.alert('Canceled', 'Your subscription will be canceled at the end of the current period.');
        await refreshPlan();
      } else {
        Alert.alert('Error', res?.error || 'Unable to cancel subscription');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Cancel failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Manage Subscription', headerBackTitle: 'Back', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>Subscription</Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].mutedText }]}>Manage your membership plan.</Text>

        <View style={[styles.card, { 
          backgroundColor: Colors[colorScheme ?? 'light'].card,
          borderColor: Colors[colorScheme ?? 'light'].border
        }]}>
          <Text style={[styles.rowLabel, { color: Colors[colorScheme ?? 'light'].mutedText }]}>Current plan</Text>
          <Text style={[styles.rowValue, { color: Colors[colorScheme ?? 'light'].text }]}>{plan || 'rookie'}</Text>

          {plan && plan !== 'rookie' ? (
            // Paid plans (veteran/legend) - show cancel option
            <View style={{ marginTop: 12 }}>
              <Button onPress={onCancel} disabled={loading} variant="outline">
                <Text>Cancel subscription</Text>
              </Button>
            </View>
          ) : Platform.OS === 'ios' ? (
            <Text style={[styles.description, { color: Colors[colorScheme ?? 'light'].mutedText }]}>
              Paid coach plan upgrades are currently unavailable in the iOS app.
            </Text>
          ) : (
            // Free plan (rookie) or no plan - show upgrade options
            <>
              <Text style={[styles.description, { color: Colors[colorScheme ?? 'light'].mutedText }]}>Choose a plan to unlock organization features.</Text>
              <View style={{ height: 12 }} />
              <Button onPress={() => onSubscribe('veteran')} disabled={loading}><Text>Upgrade to Veteran</Text></Button>
              <View style={{ height: 8 }} />
              <Button onPress={() => onSubscribe('legend')} disabled={loading}><Text>Upgrade to Legend</Text></Button>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { marginBottom: 12 },
  card: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 12 },
  rowValue: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  description: { marginTop: 12 },
});
