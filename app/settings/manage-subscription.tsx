import { Subscriptions, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { useFocusEffect } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ManageSubscription() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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
    } catch {
      // ignore
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

  const onSubscribe = async (targetPlan: 'veteran' | 'legend') => {
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Upgrade on the web',
        'Coach subscriptions are managed through our secure web portal. Please sign in at varsityhub.app from a desktop browser to upgrade your plan.',
      );
      return;
    }
    setLoading(true);
    try {
      const res: any = await Subscriptions.createCheckout(targetPlan);
      if (res?.url) {
        const sessionId = typeof res.session_id === 'string' ? res.session_id : null;
        try {
          await WebBrowser.openBrowserAsync(res.url);
        } finally {
          if (sessionId) {
            const finalized = await finalizeWithRetry(sessionId);
            if (!finalized) {
              console.warn('Subscription finalize pending after retries', { sessionId });
            }
          }
          await refreshPlan();
        }
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
            { text: 'Resend verification', onPress: async () => { try { await User.requestVerification(); Alert.alert('Verification sent', 'Check your email for a verification link.'); } catch { Alert.alert('Error', 'Unable to resend verification.'); } } },
            { text: 'OK', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Error', e?.message || 'Subscription failed');
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
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Manage Subscription', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.title, { color: isDark ? '#ECEDEE' : '#11181C' }]}>Subscription</Text>
        <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Manage your membership plan.</Text>

        <View style={[styles.card, { 
          backgroundColor: isDark ? '#1F2937' : '#fff',
          borderColor: isDark ? '#374151' : '#E5E7EB'
        }]}>
          <Text style={[styles.rowLabel, { color: isDark ? '#9CA3AF' : '#6b7280' }]}>Current plan</Text>
          <Text style={[styles.rowValue, { color: isDark ? '#ECEDEE' : '#11181C' }]}>{plan || 'rookie'}</Text>

          {plan && plan !== 'rookie' ? (
            // Paid plans (veteran/legend) - show cancel option
            <View style={{ marginTop: 12 }}>
              <Button onPress={onCancel} disabled={loading} variant="outline">
                <Text>Cancel subscription</Text>
              </Button>
            </View>
          ) : (
            // Free plan (rookie) or no plan - show upgrade options
            <>
              <Text style={[styles.description, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Choose a plan to unlock organization features.</Text>
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
