import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { User } from '@/api/entities';
// @ts-ignore
import { httpPost } from '@/api/http';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type AdDetails = {
  id: string;
  business_name: string;
  status: string;
  payment_status: string;
  zip_code?: string;
  dates: string[];
};

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const params = useLocalSearchParams<{ session_id?: string; type?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adDetails, setAdDetails] = useState<AdDetails | null>(null);
  const [amountCents, setAmountCents] = useState(0);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const isAdPayment = params.type === 'ad';
  const isSubscription = params.type === 'subscription';
  const maxAttempts = 10;

  const clearRetry = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const verify = async () => {
      try {
        if (!params.session_id) {
          setError('Payment session information is missing. If you completed payment, please contact support.');
          setLoading(false);
          return;
        }
        const sessionId = params.session_id.trim();
        if (!sessionId.startsWith('cs_') && !sessionId.startsWith('sess_')) {
          setError('Invalid payment session. Please contact support if you completed payment.');
          setLoading(false);
          return;
        }

        if (isAdPayment) {
          try {
            const result = await httpPost('/payments/finalize-session', { session_id: sessionId });
            if (result?.ad) {
              setAdDetails(result.ad);
              setAmountCents(result.amount_cents || 0);
            }
          } catch (err: any) {
            if (__DEV__) console.warn('[payment-success] finalize failed:', err?.message);
          }
          // Show confirmation (even if finalize was already done by webhook)
          setLoading(false);
          // Animate in
          Animated.sequence([
            Animated.timing(checkOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          ]).start();
        } else {
          // Subscription flow — poll for plan upgrade (Rule A: plan set = payment done)
          try {
            const me = await User.me();
            const plan = me?.preferences?.plan;
            const pending = me?.preferences?.payment_pending;
            const pendingPlan = me?.preferences?.pending_plan;
            if ((plan === 'veteran' || plan === 'legend') && pending === false && !pendingPlan) {
              setLoading(false);
              Animated.sequence([
                Animated.timing(checkOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
              ]).start();
            } else if (verificationAttempt < maxAttempts - 1) {
              // Midway fallback: try finalize-session to nudge the server
              if (verificationAttempt === 4) {
                try {
                  await httpPost('/payments/finalize-session', { session_id: sessionId });
                } catch { /* finalize may already be done */ }
              }
              clearRetry();
              retryTimeoutRef.current = setTimeout(() => {
                setVerificationAttempt((a) => a + 1);
              }, 3000);
            } else {
              // Last attempt — try finalize
              try {
                await httpPost('/payments/finalize-session', { session_id: sessionId });
                const meAfter = await User.me();
                if ((meAfter?.preferences?.plan === 'veteran' || meAfter?.preferences?.plan === 'legend') && meAfter?.preferences?.payment_pending === false && !meAfter?.preferences?.pending_plan) {
                  setLoading(false);
                  return;
                }
              } catch { /* ignore */ }
              setError('Payment verification timed out. Your payment may still be processing.');
              setLoading(false);
            }
          } catch {
            if (verificationAttempt >= maxAttempts - 1) {
              setError('Unable to verify payment. Please contact support.');
              setLoading(false);
            } else {
              clearRetry();
              retryTimeoutRef.current = setTimeout(() => setVerificationAttempt((a) => a + 1), 2000);
            }
          }
        }
      } catch (err: any) {
        setError('Unable to verify payment status');
        if (__DEV__) console.error('Payment verification error:', err);
        setLoading(false);
      }
    };

    void verify();
    return () => clearRetry();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- checkOpacity and contentOpacity are Animated.Values (ref-like), adding them causes infinite loops
  }, [params.session_id, isAdPayment, verificationAttempt]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return iso; }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.tint} />
            <Text style={[styles.loadingText, { color: theme.mutedText }]}>Confirming your payment{verificationAttempt > 3 ? '\nThis may take a moment...' : '...'}</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <MaterialIcons name="warning-amber" size={56} color="#DC2626" />
            <Text style={[styles.errorTitle, { color: theme.text }]}>Verification Issue</Text>
            <Text style={[styles.errorBody, { color: theme.mutedText }]}>{error}</Text>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
              onPress={() => { setLoading(true); setError(null); setVerificationAttempt(0); }}
            >
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={() => { if (router.canGoBack()) router.back(); else router.push('/(tabs)/feed'); }}>
              <Text style={[styles.linkBtnText, { color: theme.mutedText }]}>Continue to App</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Checkmark */}
            <Animated.View style={[styles.checkWrap, { opacity: checkOpacity }]}>
              <View style={styles.checkCircle}>
                <MaterialIcons name="check" size={48} color="#fff" />
              </View>
              <Text style={[styles.successTitle, { color: theme.text }]}>Payment Confirmed!</Text>
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
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>PAID</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#166534' }]}>ACTIVE</Text>
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
                  <View style={[styles.infoBox, { backgroundColor: colorScheme === 'dark' ? '#052e16' : '#F0FDF4' }]}>
                    <Text style={[styles.infoText, { color: colorScheme === 'dark' ? '#86EFAC' : '#166534' }]}>Ad reservation confirmed</Text>
                    <Text style={[styles.infoText, { color: colorScheme === 'dark' ? '#86EFAC' : '#166534' }]}>Dates are now reserved</Text>
                    <Text style={[styles.infoText, { color: colorScheme === 'dark' ? '#86EFAC' : '#166534' }]}>Your ad is live</Text>
                  </View>
                </View>
              )}

              {/* Subscription confirmed */}
              {isSubscription && (
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={[styles.infoBox, { backgroundColor: colorScheme === 'dark' ? '#052e16' : '#F0FDF4' }]}>
                    <Text style={[styles.infoText, { color: colorScheme === 'dark' ? '#86EFAC' : '#166534' }]}>Subscription active</Text>
                    <Text style={[styles.infoText, { color: colorScheme === 'dark' ? '#86EFAC' : '#166534' }]}>Premium features unlocked</Text>
                  </View>
                </View>
              )}

              {/* Action buttons */}
              <View style={styles.actions}>
                {isAdPayment && (
                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
                    onPress={() => { if (router.canGoBack()) router.back(); else router.push('/(tabs)/my-ads'); }}
                  >
                    <MaterialIcons name="campaign" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>View My Ads</Text>
                  </Pressable>
                )}
                {isSubscription && (
                  <>
                    <Pressable
                      style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
                      onPress={() => { if (router.canGoBack()) router.back(); else router.push('/(tabs)/create-team'); }}
                    >
                      <Text style={styles.primaryBtnText}>Create a Team</Text>
                    </Pressable>
                  </>
                )}
                <Pressable
                  style={[styles.secondaryBtn, { borderColor: theme.border }]}
                  onPress={() => { if (router.canGoBack()) router.back(); else router.push('/(tabs)/feed'); }}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Back to Feed</Text>
                </Pressable>
              </View>
            </Animated.View>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 24, alignItems: 'center', paddingBottom: 48 },
  loadingText: { marginTop: 16, fontSize: 16, textAlign: 'center' },
  errorTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  errorBody: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  checkWrap: { alignItems: 'center', marginBottom: 24, marginTop: 32 },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#16A34A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  successTitle: { fontSize: 26, fontWeight: '800', marginTop: 16 },
  card: {
    width: '100%', borderRadius: 16, padding: 20,
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 20,
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
