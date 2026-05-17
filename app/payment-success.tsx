import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ExpoLinking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Advertisement, Payments, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getAdScheduleBucket } from '@/utils/adStatusBadge';
import { getCanonicalBillingState } from '@/utils/billingState';
import { setPendingDeepLink } from '@/utils/deepLinks';
import { safeGoBack } from '@/utils/navigation';

type AdDetails = {
  id: string;
  business_name: string;
  status: string;
  payment_status: string;
  zip_code?: string;
  dates: string[];
};

function PaymentSuccessScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const params = useLocalSearchParams<{ session_id?: string; type?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignInAction, setShowSignInAction] = useState(false);
  const [adDetails, setAdDetails] = useState<AdDetails | null>(null);
  const [amountCents, setAmountCents] = useState(0);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [manualRetryCount, setManualRetryCount] = useState(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_MANUAL_RETRIES = 3;
  const adIdRef = useRef<string | null>(null);
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const paymentType = params.type === 'ad' || params.type === 'subscription' ? params.type : null;
  const isAdPayment = paymentType === 'ad';
  const isSubscription = paymentType === 'subscription';
  const authAttemptOwner = user?.id ? String(user.id) : 'anonymous';
  const maxAttempts = 5;       // subscription: 5 × 2s = 10s (down from 10 × 3s = 30s)
  const adMaxAttempts = 5;     // ad: 5 × 2s = 10s (down from 15 × 2s = 30s)

  const clearRetry = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const isAuthError = (err: any) => {
    const status = err?.status ?? err?.response?.status;
    const message = String(err?.message || err?.data?.error || '').toLowerCase();
    return (
      status === 401 ||
      status === 403 ||
      message.includes('unauthorized') ||
      message.includes('session expired') ||
      message.includes('forbidden')
    );
  };

  const openSignInRecovery = () => {
    const queryParams: Record<string, string> = {};
    if (params.session_id) queryParams.session_id = params.session_id;
    if (params.type) queryParams.type = params.type;
    setPendingDeepLink(ExpoLinking.createURL('payment-success', { queryParams }));
    router.push('/sign-in');
  };

  const showSuccessState = () => {
    setError(null);
    setShowSignInAction(false);
    setLoading(false);
    checkOpacity.setValue(0);
    contentOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(checkOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const hasActivePremiumPlan = async () => {
    const me = await User.me({ force: true });
    const billing = getCanonicalBillingState(me);
    return (
      (billing.plan === 'veteran' || billing.plan === 'legend') &&
      !billing.payment_pending &&
      !billing.pending_plan
    );
  };

  const attemptKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const rawSessionId = params.session_id?.trim() || '';
    // Include the active auth identity so returning from sign-in recovery
    // re-runs verification for the newly signed-in account.
    const attemptKey = `${paymentType || 'unknown'}:${rawSessionId}:${verificationAttempt}:${authAttemptOwner}`;
    if (attemptKeyRef.current === attemptKey) return;
    attemptKeyRef.current = attemptKey;

    let mounted = true;
    const verify = async () => {
      try {
        setShowSignInAction(false);
        if (!paymentType) {
          if (!mounted) return;
          setError('This payment link is invalid or incomplete. Please return to the app and try again.');
          setLoading(false);
          return;
        }
        if (!params.session_id) {
          if (!mounted) return;
          setError('Payment session information is missing. If you completed payment, please contact support.');
          setLoading(false);
          return;
        }
        const sessionId = params.session_id.trim();
        if (!sessionId.startsWith('cs_') && !sessionId.startsWith('sess_')) {
          if (!mounted) return;
          setError('Invalid payment session. Please contact support if you completed payment.');
          setLoading(false);
          return;
        }

        if (isSubscription && !user) {
          if (!mounted) return;
          setShowSignInAction(true);
          setError('Sign in with the account that started this purchase to confirm your subscription and unlock premium features.');
          setLoading(false);
          return;
        }

        // Call finalize-session on every attempt.
        // This keeps the fallback loop moving when the first request returned `pending`,
        // and refreshes the cached /me response before subscription checks.
        try {
          const result = await Payments.finalizeSession(sessionId);
          if (!mounted) return;

          if (isAdPayment && result?.ad) {
            setAdDetails(result.ad);
            setAmountCents(result.amount_cents || 0);
            adIdRef.current = result.ad.id ? String(result.ad.id) : null;
            if (result.ad.status === 'active' || result.ad.payment_status === 'paid') {
              showSuccessState();
              return;
            }
          } else if (isSubscription) {
            if (!mounted) return;
            if (await hasActivePremiumPlan()) {
              showSuccessState();
              return;
            }
          }
        } catch (err: any) {
          if (__DEV__) console.warn('[payment-success] finalize attempt failed:', err?.message);
          if (isSubscription && isAuthError(err)) {
            if (!mounted) return;
            setShowSignInAction(true);
            setError('We could not verify this subscription on your current session. Sign in with the purchasing account and try again.');
            setLoading(false);
            return;
          }
        }

        if (!mounted) return;

        // ── Step 2: Polling fallback — finalize didn't confirm yet, check raw status
        if (isAdPayment) {
          const adId = adIdRef.current;
          if (adId) {
            try {
              const adData: any = await Advertisement.get(adId);
              if (!mounted) return;
              if (adData?.status === 'active' || adData?.payment_status === 'paid') {
                setAdDetails(adData);
                showSuccessState();
                return;
              }
            } catch (e) {
              if (__DEV__) console.warn('[payment-success] ad status poll:', e);
            }
          }
        } else {
          try {
            if (!mounted) return;
            if (await hasActivePremiumPlan()) {
              showSuccessState();
              return;
            }
          } catch (e: any) {
            if (__DEV__) console.warn('[payment-success] subscription poll:', e);
            if (isAuthError(e)) {
              if (!mounted) return;
              setShowSignInAction(true);
              setError('Your purchase may have completed, but we need you to sign in with the purchasing account to confirm the subscription.');
              setLoading(false);
              return;
            }
          }
        }

        if (!mounted) return;
        const currentMax = isAdPayment ? adMaxAttempts : maxAttempts;
        if (verificationAttempt < currentMax - 1) {
          clearRetry();
          retryTimeoutRef.current = setTimeout(() => {
            attemptKeyRef.current = null;
            setVerificationAttempt((a) => a + 1);
          }, 2000);
        } else {
          if (isAdPayment) {
            setError("Your ad is being processed — you'll receive an email confirmation shortly.");
          } else {
            setShowSignInAction(true);
            setError(user
              ? 'This purchase is taking longer than expected to appear on this account. If you checked out under a different account, switch accounts and try again.'
              : 'We could not confirm this subscription without a signed-in session. Sign in with the purchasing account and try again.');
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        setError('Unable to verify payment status');
        if (__DEV__) console.error('Payment verification error:', err);
        setLoading(false);
      }
    };

    void verify();
    return () => { mounted = false; clearRetry(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- checkOpacity and contentOpacity are Animated.Values (ref-like), adding them causes infinite loops
  }, [params.session_id, paymentType, isAdPayment, isSubscription, verificationAttempt, authAttemptOwner]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return iso; }
  };

  const adScheduleBucket = getAdScheduleBucket(adDetails?.dates ?? []);
  const isAdCurrentlyLive = isAdPayment && adDetails?.status === 'active' && adScheduleBucket === 'live';
  const adSuccessTitle = !isAdPayment
    ? 'Payment Confirmed!'
    : isAdCurrentlyLive
      ? 'Your Ad is Live!'
      : adScheduleBucket === 'scheduled'
        ? 'Payment Confirmed! Your Ad Is Scheduled'
        : 'Payment Confirmed!';
  const adSuccessSubtitle = isAdCurrentlyLive
    ? 'Your campaign is active now.'
    : adScheduleBucket === 'scheduled'
      ? 'Your dates are reserved. The ad will go live automatically on the scheduled dates.'
      : 'Your payment is confirmed. Your ad will go live shortly.';
  const paidStatusBadgeStyle =
    colorScheme === 'dark'
      ? { backgroundColor: '#052e16', borderColor: '#166534', textColor: '#86EFAC' }
      : { backgroundColor: '#DCFCE7', borderColor: '#86EFAC', textColor: '#166534' };
  const adDeliveryBadgeStyle =
    isAdCurrentlyLive
      ? (colorScheme === 'dark'
          ? { backgroundColor: '#052e16', borderColor: '#166534', textColor: '#86EFAC', label: 'LIVE' }
          : { backgroundColor: '#DCFCE7', borderColor: '#86EFAC', textColor: '#166534', label: 'LIVE' })
      : adScheduleBucket === 'scheduled'
        ? (colorScheme === 'dark'
            ? { backgroundColor: '#172554', borderColor: '#1d4ed8', textColor: '#93C5FD', label: 'SCHEDULED' }
            : { backgroundColor: '#DBEAFE', borderColor: '#93C5FD', textColor: '#1D4ED8', label: 'SCHEDULED' })
        : adScheduleBucket === 'completed'
          ? (colorScheme === 'dark'
              ? { backgroundColor: '#1f2937', borderColor: '#4b5563', textColor: '#E5E7EB', label: 'COMPLETED' }
              : { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB', textColor: '#4B5563', label: 'COMPLETED' })
          : (colorScheme === 'dark'
              ? { backgroundColor: '#422006', borderColor: '#a16207', textColor: '#FCD34D', label: 'GOING LIVE' }
              : { backgroundColor: '#FEF3C7', borderColor: '#FCD34D', textColor: '#92400E', label: 'GOING LIVE' });

  const SuccessInfoBox = ({ lines }: { lines: string[] }) => (
    <View style={[styles.infoBox, { backgroundColor: colorScheme === 'dark' ? '#052e16' : '#F0FDF4' }]}>
      {lines.map(line => (
        <Text
          key={line}
          style={[styles.infoText, { color: colorScheme === 'dark' ? '#86EFAC' : '#166534' }]}
        >
          {line}
        </Text>
      ))}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        {loading ? (
          <View style={styles.center}>
            <View style={styles.centerInner}>
              <ActivityIndicator size="large" color={theme.tint} />
              <Text style={[styles.loadingText, { color: theme.mutedText }]}>
                {isAdPayment && verificationAttempt > 0
                  ? 'Activating your ad'
                  : isSubscription
                    ? 'Confirming your subscription'
                    : 'Confirming your payment'}
                {verificationAttempt > 3 ? '\nThis may take a moment...' : '...'}
              </Text>
            </View>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <View style={styles.centerInner}>
              <MaterialIcons name="warning-amber" size={56} color="#DC2626" />
              <Text style={[styles.errorTitle, { color: theme.text }]}>Verification Issue</Text>
              <Text style={[styles.errorBody, { color: theme.mutedText }]}>{error}</Text>
              {manualRetryCount < MAX_MANUAL_RETRIES ? (
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
                  onPress={() => {
                    attemptKeyRef.current = null;
                    setLoading(true);
                    setError(null);
                    setShowSignInAction(false);
                    setVerificationAttempt(0);
                    setManualRetryCount((n) => n + 1);
                  }}
                >
                  <Text style={styles.primaryBtnText}>
                    Try Again {manualRetryCount > 0 ? `(${MAX_MANUAL_RETRIES - manualRetryCount} left)` : ''}
                  </Text>
                </Pressable>
              ) : (
                // After 3 manual retries the underlying condition (webhook
                // delay, session pending, etc.) is unlikely to resolve from
                // another tap. Stop offering the loop and route the user to
                // support, where the operator can look up the session_id.
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
                  onPress={() => router.replace('/(tabs)' as any)}
                >
                  <Text style={styles.primaryBtnText}>Continue to App</Text>
                </Pressable>
              )}
              {showSignInAction ? (
                <Pressable
                  style={[styles.secondaryBtn, { borderColor: theme.border, width: '100%', marginTop: 12 }]}
                  onPress={openSignInRecovery}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                    {user ? 'Switch Account' : 'Sign In to Confirm'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  void Linking.openURL('mailto:customerservice@varsityhub.app?subject=Payment%20Verification%20Issue');
                }}
              >
                <Text style={[styles.linkBtnText, { color: theme.tint }]}>Contact Support</Text>
              </Pressable>
              <Pressable style={styles.linkBtn} onPress={() => { safeGoBack(router, '/(tabs)/feed'); }}>
                <Text style={[styles.linkBtnText, { color: theme.mutedText }]}>Continue to App</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={[styles.contentInner, isLargeScreen && styles.contentInnerLarge]}>
              {/* Checkmark */}
              <Animated.View style={[styles.checkWrap, { opacity: checkOpacity }]}>
                <View style={styles.checkCircle}>
                  <MaterialIcons name="check" size={48} color="#fff" />
                </View>
                <Text style={[styles.successTitle, { color: theme.text }]}>{adSuccessTitle}</Text>
                {isAdPayment ? (
                  <Text style={[styles.successSubtitle, { color: theme.mutedText }]}>{adSuccessSubtitle}</Text>
                ) : null}
              </Animated.View>

              <Animated.View style={{ opacity: contentOpacity, width: '100%' }}>
                {/* Ad details card */}
                {isAdPayment && adDetails && (
                  <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.cardLabel, { color: theme.mutedText }]}>BUSINESS</Text>
                    <Text style={[styles.cardValue, { color: theme.text }]}>{adDetails.business_name}</Text>

                    {adDetails.zip_code && (
                      <>
                        <Text style={[styles.cardLabel, { color: theme.mutedText, marginTop: 12 }]}>COVERAGE</Text>
                        <Text style={[styles.cardValue, { color: theme.text }]}>Zip {adDetails.zip_code}</Text>
                      </>
                    )}

                    <Text style={[styles.cardLabel, { color: theme.mutedText, marginTop: 12 }]}>AMOUNT PAID</Text>
                    <Text style={[styles.cardValue, { color: theme.text }]}>${(amountCents / 100).toFixed(2)}</Text>

                    <Text style={[styles.cardLabel, { color: theme.mutedText, marginTop: 12 }]}>STATUS</Text>
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: paidStatusBadgeStyle.backgroundColor,
                            borderColor: paidStatusBadgeStyle.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: paidStatusBadgeStyle.textColor }]}>PAID</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: adDeliveryBadgeStyle.backgroundColor,
                            borderColor: adDeliveryBadgeStyle.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: adDeliveryBadgeStyle.textColor }]}>
                          {adDeliveryBadgeStyle.label}
                        </Text>
                      </View>
                    </View>

                    {adDetails.dates.length > 0 && (
                      <>
                        <Text style={[styles.cardLabel, { color: theme.mutedText, marginTop: 12 }]}>
                          RESERVED DATES ({adDetails.dates.length})
                        </Text>
                        <View style={styles.datesWrap}>
                          {adDetails.dates.sort().map((d) => (
                            <View key={d} style={[styles.datePill, { borderColor: theme.border }]}>
                              <MaterialIcons name="event" size={14} color={theme.tint} />
                              <Text style={[styles.datePillText, { color: theme.text }]}>{formatDate(d)}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                )}

                {/* Ad payment with no details returned (webhook already processed) */}
                {isAdPayment && !adDetails && (
                  <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <SuccessInfoBox
                      lines={[
                        'Ad reservation confirmed',
                        'Dates are now reserved',
                        'Your ad will go live on the scheduled dates',
                      ]}
                    />
                  </View>
                )}

                {/* Subscription confirmed */}
                {isSubscription && (
                  <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <SuccessInfoBox lines={['Subscription active', 'Premium features unlocked']} />
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.actions}>
                  {isAdPayment && (
                    <Pressable
                      style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
                      onPress={() => { safeGoBack(router, '/my-ads'); }}
                    >
                      <MaterialIcons name="campaign" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryBtnText}>View My Ads</Text>
                    </Pressable>
                  )}
                  {isSubscription && (
                    <Pressable
                      style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
                      onPress={() => { safeGoBack(router, '/create-team'); }}
                    >
                      <Text style={styles.primaryBtnText}>Create a Team</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.secondaryBtn, { borderColor: theme.border }]}
                    onPress={() => { safeGoBack(router, '/(tabs)/feed'); }}
                  >
                    <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Back to Feed</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerInner: { width: '100%', maxWidth: 560, alignItems: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  contentInner: { width: '100%', alignSelf: 'center' },
  contentInnerLarge: { maxWidth: 860 },
  loadingText: { marginTop: 16, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  errorTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  errorBody: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  checkWrap: { alignItems: 'center', marginBottom: 24, marginTop: 32 },
  successSubtitle: { marginTop: 8, fontSize: 16, textAlign: 'center', lineHeight: 24, maxWidth: 560 },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 12px rgba(22, 163, 74, 0.3)' }
      : {
          shadowColor: '#16A34A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        }),
    elevation: 6,
  },
  successTitle: { fontSize: 28, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  card: {
    width: '100%', borderRadius: 16, padding: 20,
    borderWidth: 1, marginBottom: 20,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  cardValue: { fontSize: 17, fontWeight: '600', marginTop: 2 },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statusBadge: {
    backgroundColor: '#DBEAFE', borderWidth: 1, borderColor: '#93C5FD',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#1E40AF' },
  datesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  datePillText: { fontSize: 13, fontWeight: '500' },
  infoBox: { borderRadius: 12, padding: 16, gap: 8 },
  infoText: { fontSize: 15, fontWeight: '600' },
  actions: { width: '100%', gap: 12, marginTop: 4 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryBtn: {
    height: 48, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
  linkBtn: { marginTop: 12 },
  linkBtnText: { fontSize: 15 },
});

export default PaymentSuccessScreen;
