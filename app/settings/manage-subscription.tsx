import { Payments, Subscriptions, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthProvider';
import { useVHubIAP } from '@/hooks/useIAP';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { ROOKIE_TEAM_LIMIT } from '@/constants/plans';
import { SubscriptionDisclosureCard } from '@/components/subscription/SubscriptionDisclosureCard';
import { getFreshAuthSnapshot } from '@/utils/authState';
import { getCanonicalBillingState } from '@/utils/billingState';
import { openExternalUrl } from '@/utils/openExternalUrl';
import { captureBreadcrumb } from '@/utils/sentry';
import { usePaymentSheet } from '@/utils/stripe';

interface PaymentSheetResponse {
  paymentIntent?: string;
  ephemeralKey?: string;
  customer?: string;
  subscriptionId?: string;
  free?: boolean;
}

interface FinalizeResponse {
  pending?: boolean;
}

interface CancelResponse {
  ok?: boolean;
  error?: string;
}

const isIOS = Platform.OS === 'ios';

function ManageSubscription() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { checkAuth, user } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [paidByOwner, setPaidByOwner] = useState(false);
  const [ownerLeagueName, setOwnerLeagueName] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);

  async function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function finalizeWithRetry(
    subscriptionId: string,
    attempts: number = 5,
    delayMs: number = 2000
  ) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const res = (await Subscriptions.finalizeSubscription(subscriptionId)) as FinalizeResponse;
        if (!res?.pending) return true;
      } catch (err) {
        if (__DEV__) console.warn('Finalize session attempt failed', err);
      }
      if (attempt < attempts - 1) await wait(delayMs);
    }
    return false;
  }

  const refreshPlan = useCallback(async () => {
    try {
      const me: any = await getFreshAuthSnapshot(checkAuth, user);
      if (!me) {
        setPaidByOwner(false);
        setOwnerLeagueName(null);
        setApprovalStatus(null);
        setPlan(null);
        setPaymentPending(false);
        return;
      }
      const billing = getCanonicalBillingState(me);
      setPaidByOwner(!!me?.paid_by_owner);
      setApprovalStatus(me?.approval_status || null);
      setPlan(billing.plan);
      setPaymentPending(billing.payment_pending);

      // If covered by owner, fetch the league name
      if (me?.paid_by_owner) {
        try {
          const { Organization } = await import('@/api/entities');
          const summaries: any = await Organization.reviewSummaries();
          if (Array.isArray(summaries) && summaries.length > 0) {
            setOwnerLeagueName(summaries[0]?.organization?.name || null);
          }
        } catch {
          /* ignore */
        }
      }
    } catch (error) {
      if (__DEV__) console.warn('[manage-subscription] Failed to load plan:', error);
    }
  }, [checkAuth, user?.id]);

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
  const {
    connected: iapConnected,
    purchase: iapPurchase,
    restore: _iapRestore,
    purchasing: _iapPurchasing,
  } = useVHubIAP();

  const onSubscribe = async (targetPlan: 'veteran' | 'legend') => {
    captureBreadcrumb(
      'Subscription checkout initiated from manage subscription',
      'payments.subscription',
      {
        tier: targetPlan,
        platform: Platform.OS,
        entry: 'manage_subscription',
      }
    );
    // iOS and Android: Use native IAP (Apple IAP / Google Play Billing)
    if (isIOS || Platform.OS === 'android') {
      if (!iapConnected) {
        Alert.alert(
          'Store Unavailable',
          isIOS
            ? 'Unable to connect to the App Store. Please try again later.'
            : 'Unable to connect to Google Play. Please try again later.'
        );
        return;
      }
      setLoading(true);
      try {
        const success = await iapPurchase(targetPlan);
        captureBreadcrumb('Native subscription purchase returned', 'payments.subscription', {
          tier: targetPlan,
          success,
          entry: 'manage_subscription',
        });
        if (success) {
          Alert.alert('Success', 'Your subscription is now active!');
          await refreshPlan();
        }
      } catch (err: any) {
        captureBreadcrumb(
          'Native subscription purchase failed',
          'payments.subscription',
          {
            tier: targetPlan,
            entry: 'manage_subscription',
            error: err?.message || 'unknown_error',
          },
          'error'
        );
        Alert.alert('Purchase Failed', err?.message || 'Unable to complete purchase.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert(
        'Web checkout unavailable',
        'Subscription checkout is currently supported in the mobile app only. Please continue on iOS or Android.'
      );
      return;
    }

    // Non-mobile fallback: Use Stripe PaymentSheet
    setLoading(true);
    try {
      captureBreadcrumb('Subscription payment sheet request started', 'payments.subscription', {
        tier: targetPlan,
        entry: 'manage_subscription',
      });
      const res = (await Payments.createPaymentSheet({
        plan: targetPlan,
      })) as PaymentSheetResponse;
      if (res?.paymentIntent && typeof res.paymentIntent === 'string') {
        captureBreadcrumb('Subscription payment sheet init started', 'payments.subscription', {
          tier: targetPlan,
          entry: 'manage_subscription',
        });
        // Stripe fallback (non-mobile only) — no Apple Pay since iOS uses IAP
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: res.paymentIntent,
          customerEphemeralKeySecret: res.ephemeralKey,
          customerId: res.customer,
          merchantDisplayName: 'Varsity Hub',
          googlePay:
            (Platform.OS as string) === 'android'
              ? { merchantCountryCode: 'US', testEnv: __DEV__ }
              : undefined,
          paymentMethodOrder: ['google_pay', 'card'],
        });
        if (initError) {
          captureBreadcrumb(
            'Subscription payment sheet init failed',
            'payments.subscription',
            {
              tier: targetPlan,
              entry: 'manage_subscription',
              error: initError.message,
            },
            'error'
          );
          Alert.alert('Error', initError.message);
          return;
        }
        captureBreadcrumb('Subscription payment sheet presented', 'payments.subscription', {
          tier: targetPlan,
          entry: 'manage_subscription',
        });
        const { error } = await presentPaymentSheet();
        if (error) {
          captureBreadcrumb(
            'Subscription payment sheet failed',
            'payments.subscription',
            {
              tier: targetPlan,
              entry: 'manage_subscription',
              code: error.code,
              error: error.message || 'unknown_error',
            },
            error.code === 'Canceled' ? 'info' : 'error'
          );
          if (error.code !== 'Canceled')
            Alert.alert('Payment Failed', error.message || 'Payment could not be completed.');
          return;
        }
        // Payment succeeded — confirm the Stripe subscription server-side
        if (res.subscriptionId) {
          captureBreadcrumb('Subscription finalize retry started', 'payments.subscription', {
            tier: targetPlan,
            entry: 'manage_subscription',
            has_subscription_id: true,
          });
          const finalized = await finalizeWithRetry(res.subscriptionId);
          if (!finalized) {
            captureBreadcrumb(
              'Subscription finalize still pending',
              'payments.subscription',
              {
                tier: targetPlan,
                entry: 'manage_subscription',
              },
              'warning'
            );
            if (__DEV__)
              console.warn('Subscription finalize pending after retries', {
                subscriptionId: res.subscriptionId,
              });
            Alert.alert(
              'Payment Received',
              'Your payment went through. Your plan may take a moment to activate — pull down to refresh.'
            );
          } else {
            captureBreadcrumb('Subscription finalize succeeded', 'payments.subscription', {
              tier: targetPlan,
              entry: 'manage_subscription',
            });
            Alert.alert('Success', 'Your subscription is now active!');
          }
        } else {
          captureBreadcrumb(
            'Subscription payment completed without finalize step',
            'payments.subscription',
            {
              tier: targetPlan,
              entry: 'manage_subscription',
            }
          );
          Alert.alert('Success', 'Your subscription is now active!');
        }
        await refreshPlan();
      } else if (res?.free) {
        captureBreadcrumb('Subscription free activation completed', 'payments.subscription', {
          tier: targetPlan,
          entry: 'manage_subscription',
        });
        Alert.alert('Subscribed', 'Your plan is now active.');
        await refreshPlan();
      } else {
        Alert.alert('Error', 'Unable to start checkout.');
      }
    } catch (e: any) {
      captureBreadcrumb(
        'Subscription checkout failed from manage subscription',
        'payments.subscription',
        {
          tier: targetPlan,
          entry: 'manage_subscription',
          error: e?.data?.error || e?.message || 'unknown_error',
          status: e?.status,
        },
        'error'
      );
      // If email is unverified the server will return 403 — surface a helpful action
      if (e && e.status === 403) {
        Alert.alert(
          'Email verification required',
          'You must verify your email before purchasing a plan.',
          [
            { text: 'Verify now', onPress: () => void router.push('/verify') },
            { text: 'OK', style: 'cancel' },
          ]
        );
      } else {
        const raw = e?.data?.error || e?.message || '';
        const safeMsg = /prod_|price_/i.test(raw)
          ? 'Subscription failed. Please try again or contact support.'
          : raw || 'Subscription failed';
        Alert.alert('Error', safeMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onCancel = async () => {
    setLoading(true);
    try {
      const res = (await Subscriptions.cancel()) as CancelResponse;
      if (res?.ok) {
        Alert.alert(
          'Canceled',
          'Your subscription will be canceled at the end of the current period.'
        );
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

  const onSkipPayment = async () => {
    Alert.alert(
      'Continue as Rookie?',
      `You can upgrade to a paid plan anytime from Settings. Your team will be limited to ${ROOKIE_TEAM_LIMIT} teams and 50 roster spots on the free plan.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue as Rookie',
          onPress: async () => {
            setLoading(true);
            try {
              await User.skipPayment();
              await refreshPlan();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Unable to skip payment');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{ title: 'Manage Subscription', headerBackTitle: 'Back', headerShown: true }}
      />
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View
          style={[
            styles.contentInner,
            isLargeScreen ? styles.contentInnerLarge : null,
          ]}
        >
          <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
            Subscription
          </Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].mutedText }]}>
            Manage your membership plan.
          </Text>

          <View
            style={[
              styles.card,
              {
                backgroundColor: Colors[colorScheme ?? 'light'].card,
                borderColor: Colors[colorScheme ?? 'light'].border,
              },
            ]}
          >
            {/* Approved coach covered by league owner */}
            {paidByOwner && approvalStatus === 'APPROVED' ? (
              <>
                <Text
                  style={[styles.rowLabel, { color: Colors[colorScheme ?? 'light'].mutedText }]}
                >
                  Your subscription
                </Text>
                <Text style={[styles.rowValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Covered by {ownerLeagueName || 'your organization'}
                </Text>
                <Text
                  style={[styles.description, { color: Colors[colorScheme ?? 'light'].mutedText }]}
                >
                  Your league owner manages the subscription. You have full access to coach
                  features at no cost.
                </Text>
              </>
            ) : paidByOwner && approvalStatus === 'PENDING' ? (
              /* Coach pending approval */
              <>
                <Text
                  style={[styles.rowLabel, { color: Colors[colorScheme ?? 'light'].mutedText }]}
                >
                  Your subscription
                </Text>
                <Text style={[styles.rowValue, { color: '#DAA520' }]}>Pending Approval</Text>
                <Text
                  style={[styles.description, { color: Colors[colorScheme ?? 'light'].mutedText }]}
                >
                  Your subscription activates after your coach application is approved by the
                  league owner.
                </Text>
              </>
            ) : (
              /* League owner or standalone user — original flow */
              <>
                <Text
                  style={[styles.rowLabel, { color: Colors[colorScheme ?? 'light'].mutedText }]}
                >
                  Current plan
                </Text>
                <Text style={[styles.rowValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {plan || 'rookie'}
                </Text>

                {plan && plan !== 'rookie' ? (
                  <View style={styles.actionsGroup}>
                    {isIOS ? (
                      <Button
                        onPress={() =>
                          void openExternalUrl('https://apps.apple.com/account/subscriptions', {
                            context: 'manage_subscription_app_store_link',
                            errorMessage: 'Unable to open App Store subscriptions right now.',
                          })
                        }
                        variant="outline"
                      >
                        <Text>Manage in App Store</Text>
                      </Button>
                    ) : Platform.OS === 'android' ? (
                      <Button
                        onPress={() =>
                          void openExternalUrl(
                            'https://play.google.com/store/account/subscriptions',
                            {
                              context: 'manage_subscription_google_play_link',
                              errorMessage:
                                'Unable to open Google Play subscriptions right now.',
                            }
                          )
                        }
                        variant="outline"
                      >
                        <Text>Manage in Google Play</Text>
                      </Button>
                    ) : (
                      <Button onPress={onCancel} disabled={loading} variant="outline">
                        <Text>Cancel subscription</Text>
                      </Button>
                    )}
                    <Button
                      onPress={() => router.push('/settings/billing-history' as any)}
                      variant="outline"
                    >
                      <Text>Billing History</Text>
                    </Button>
                  </View>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.description,
                        { color: Colors[colorScheme ?? 'light'].mutedText },
                      ]}
                    >
                      Choose a plan to unlock league features.
                    </Text>
                    <View style={styles.actionsGroup}>
                      <Button onPress={() => onSubscribe('veteran')} disabled={loading} size="lg">
                        <Text>Upgrade to Veteran</Text>
                      </Button>
                      <SubscriptionDisclosureCard
                        colorScheme={colorScheme ?? 'light'}
                        plan="veteran"
                        compact
                      />
                      <Button onPress={() => onSubscribe('legend')} disabled={loading} size="lg">
                        <Text>Upgrade to Legend</Text>
                      </Button>
                      <SubscriptionDisclosureCard
                        colorScheme={colorScheme ?? 'light'}
                        plan="legend"
                        compact
                      />
                    </View>
                    {paymentPending && (
                      <>
                        <Text
                          style={[
                            styles.description,
                            { color: Colors[colorScheme ?? 'light'].mutedText },
                          ]}
                        >
                          Not ready to subscribe? You can continue with the free Rookie plan.
                        </Text>
                        <View style={{ height: 8 }} />
                        <Button onPress={onSkipPayment} disabled={loading} variant="outline">
                          <Text>Continue as Rookie</Text>
                        </Button>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 24, paddingBottom: 32, alignItems: 'center' },
  contentInner: { width: '100%' },
  contentInnerLarge: { maxWidth: 720 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { marginBottom: 16, fontSize: 16, lineHeight: 22 },
  card: { padding: 20, borderRadius: 16, borderWidth: 1 },
  rowLabel: { fontSize: 13, fontWeight: '600' },
  rowValue: { fontSize: 21, fontWeight: '700', marginTop: 8 },
  description: { marginTop: 12, fontSize: 16, lineHeight: 23 },
  actionsGroup: { marginTop: 16, gap: 12 },
});

export default ManageSubscription;
