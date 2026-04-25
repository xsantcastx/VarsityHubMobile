import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, ScrollView, StyleSheet, Text, View, useColorScheme, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User, Notification as NotificationApi } from '@/api/entities';
import { getPostAuthRouteDecision } from '@/utils/appRouteDecisions';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';

function PendingApproval() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { signOut, checkAuth, registerPushToken } = useAuth();
  const { state: ob } = useOnboarding();
  const params = useLocalSearchParams<{ leagueName?: string; ownerName?: string }>();
  const leagueName = params.leagueName || 'the league';
  const ownerName = params.ownerName || 'the league admin';
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const redirectedRef = useRef(false);
  const proceedingAsFanRef = useRef(false);
  const isNavigatingRef = useRef(false);
  const approvalCheckInFlightRef = useRef(false);
  const lastLifecycleCheckRef = useRef(0);
  const [navigationTarget, setNavigationTarget] = useState<'organization' | 'create-team' | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const redirectToOnboarding = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    stopPolling();
    router.replace('/onboarding');
  }, [router, stopPolling]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  // Poll /me every 30 seconds to check approval_status
  const checkApproval = useCallback(async (trigger: 'initial' | 'interval' | 'focus' | 'foreground' = 'interval') => {
    if (approvalCheckInFlightRef.current) return;
    if (trigger === 'focus' || trigger === 'foreground') {
      const now = Date.now();
      if (now - lastLifecycleCheckRef.current < 2000) return;
      lastLifecycleCheckRef.current = now;
    }
    try {
      approvalCheckInFlightRef.current = true;
      setChecking(true);
      const me: any = await User.me();
      const role = String(me?.role || me?.preferences?.role || '').toLowerCase();
      const approvalStatus = String(me?.approval_status || '').toUpperCase();
      const isProceedingAsFan = me?.preferences?.proceeding_as_fan === true || role === 'fan';
      if (isProceedingAsFan || proceedingAsFanRef.current) {
        stopPolling();
        return;
      }
      const canViewPendingApproval =
        role === 'coach' && ['PENDING', 'APPROVED', 'REJECTED'].includes(approvalStatus);

      if (!canViewPendingApproval) {
        redirectToOnboarding();
        return;
      }

      if (me?.approval_status === 'REJECTED') {
        setRejected(true);
        stopPolling();
        // Fetch rejection reason from the most recent COACH_REJECTED notification
        try {
          const page = await NotificationApi.listPage(null, 20, false);
          const rejectionNotif = Array.isArray(page?.items)
            ? page.items.find((n: any) => n.type === 'COACH_REJECTED' && n.meta?.reason)
            : null;
          if (rejectionNotif?.meta?.reason) {
            setRejectionReason(rejectionNotif.meta.reason);
          }
        } catch {
          // ignore — reason display is best-effort
        }
        return;
      }
      if (me?.approval_status === 'APPROVED') {
        setApproved(true);
        const resolvedOrgId = me?.preferences?.organization_id || ob.organization_id || null;
        if (resolvedOrgId) setOrgId(resolvedOrgId);
        stopPolling();
        // Do not auto-complete coach onboarding here. Approval only unlocks
        // the real coach setup flow; the user still needs agreement + setup.
        registerPushToken().catch(() => {});
      }
    } catch {
      // ignore polling errors
    } finally {
      approvalCheckInFlightRef.current = false;
      setChecking(false);
    }
  }, [ob.organization_id, redirectToOnboarding, stopPolling]);

  useEffect(() => {
    // Initial check
    void checkApproval('initial');
    // Poll every 60 seconds — approvals are admin actions that take minutes at minimum
    // v1.0.3: poll every 30s (was 60s) — approvals are admin actions that can
    // happen any time, and the 0-60s worst-case lag between admin click and
    // coach-side "Approved!" transition was a common UX complaint during
    // testing. 30s halves that while staying well under request-rate alarms.
    intervalRef.current = setInterval(() => void checkApproval('interval'), 30000);
    // Stop polling after 30 minutes — admin has been notified, user should continue as fan
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setTimedOut(true);
    }, 30 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [checkApproval]);

  useFocusEffect(
    useCallback(() => {
      void checkApproval('focus');
    }, [checkApproval])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        void checkApproval('foreground');
      }
    });
    return () => {
      subscription.remove();
    };
  }, [checkApproval]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      if (__DEV__) console.warn('[pending-approval] Logout failed:', (err as Error)?.message ?? err);
    }
    router.replace('/sign-in');
  };

  const handleProceedAsFan = async () => {
    try {
      proceedingAsFanRef.current = true;
      stopPolling();
      await User.updatePreferences({ proceeding_as_fan: true });
      const freshUser = await checkAuth();
      const decision = getPostAuthRouteDecision(freshUser ?? null);
      router.replace(decision.route as any);
    } catch (err: any) {
      proceedingAsFanRef.current = false;
      if (__DEV__) console.warn('[pending-approval] Failed to proceed as fan:', err);
      const msg = err?.data?.error || err?.message || 'Could not complete setup. Please try again.';
      Alert.alert('Failed', msg);
    }
  };

  const handleApprovedNavigation = useCallback(async (redirect: 'organization' | 'create-team') => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setNavigationTarget(redirect);
    try {
      const freshUser = await checkAuth();
      const decision = getPostAuthRouteDecision(freshUser ?? null);
      if (decision.route === '/onboarding/coach-agreement') {
        router.replace({ pathname: decision.route, params: { redirect } } as any);
      } else {
        router.replace(decision.route as any);
      }
    } catch {
      Alert.alert('Connection Error', 'Could not verify your account status. Please check your connection and try again.');
    } finally {
      isNavigatingRef.current = false;
      if (mountedRef.current) setNavigationTarget(null);
    }
  }, [checkAuth, router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1120' : '#F8FAFC' }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image source={require('../../assets/images/logo.png')} style={{ width: 32, height: 32 }} contentFit="contain" />
          <Text style={[styles.logoText, { color: isDark ? '#F9FAFB' : '#111827' }]}>VarsityHub</Text>
        </View>

        {/* Icon */}
        <View style={[styles.iconCircle, {
          backgroundColor: rejected
            ? (isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2')
            : approved
              ? (isDark ? 'rgba(22,163,74,0.15)' : '#D1FAE5')
              : (isDark ? 'rgba(218,165,32,0.15)' : '#FEF9C3')
        }]}>
          <Image source={require('../../assets/images/logo.png')} style={{ width: 56, height: 56 }} contentFit="contain" />
        </View>

        {/* Heading */}
        <Text style={[styles.heading, { color: isDark ? '#F9FAFB' : '#111827' }]}>
          {rejected ? 'Application Not Approved' : approved ? 'You\'re Approved!' : 'Application Submitted'}
        </Text>

        {/* Subheading */}
        <Text style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          {rejected
            ? `Your request to join "${leagueName}" was not approved.${rejectionReason ? '' : ' You can continue as a fan or try joining a different league.'}`
            : approved
              ? `Your request to join "${leagueName}" was approved. Continue to accept the coach agreement and finish coach setup.`
              : `Your request to join "${leagueName}" has been sent to ${ownerName}. You'll receive a notification when approved — typically within a few hours. You can use the app as a fan while you wait.`
          }
        </Text>

        {/* Show rejection reason if available */}
        {rejected ? (
          <View style={[styles.reasonCard, { backgroundColor: isDark ? 'rgba(220,38,38,0.1)' : '#FEF2F2', borderColor: isDark ? '#7F1D1D' : '#FECACA' }]}>
            <Text style={[styles.reasonLabel, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>Reason:</Text>
            <Text style={[styles.reasonText, { color: isDark ? '#F9FAFB' : '#111827' }]}>{rejectionReason || 'No reason provided. You can continue as a fan or try joining a different league.'}</Text>
          </View>
        ) : null}

        {timedOut && !approved && !rejected && (
          <>
            <Text style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 20 }]}>
              This is taking longer than usual. We'll email you when your application is reviewed. You can continue as a fan in the meantime.
            </Text>
            <Pressable
              style={[styles.primaryButton, { marginBottom: 12 }]}
              onPress={handleProceedAsFan}
            >
              <Text style={styles.primaryButtonText}>Continue as Fan</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#D1D5DB' }]} onPress={handleLogout}>
              <Text style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Log Out</Text>
            </Pressable>
            <Text style={[styles.supportText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              Questions? Contact support@varsityhub.app
            </Text>
          </>
        )}

        {(!approved || rejected) && !timedOut && (
          <>
            {/* v1.0.2: Try-again CTA for rejected coaches. Server enforces 48hr cooldown. */}
            {rejected && (
              <Pressable
                style={[styles.primaryButton, { marginBottom: 12, backgroundColor: '#1B3A6B' }]}
                onPress={async () => {
                  try {
                    setChecking(true);
                    await User.reapplyCoach();
                    setRejected(false);
                    setRejectionReason(null);
                    Alert.alert('Application Resubmitted', 'Your coach application is pending review again.');
                    router.replace('/onboarding/coach-application' as any);
                  } catch (e: any) {
                    const msg = e?.data?.error || e?.message || 'Failed to re-apply.';
                    const code = e?.data?.code;
                    const hrs = e?.data?.retry_after_hours;
                    const retryAt = e?.data?.retry_at;
                    if (code === 'REJECTION_COOLDOWN') {
                      // v1.0.3: prefer the exact ISO timestamp when the server
                      // provides it — rounded hours alone read like "2 full
                      // days from now" when a 48hr cooldown is actually 48h
                      // from the prior rejection timestamp.
                      let msgText = 'You can try again once the cooldown expires.';
                      if (typeof retryAt === 'string') {
                        const when = new Date(retryAt);
                        if (!isNaN(when.getTime())) {
                          msgText = `You can try again on ${when.toLocaleDateString()} at ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
                        }
                      } else if (hrs) {
                        msgText = `You can try again in about ${hrs} hour${hrs === 1 ? '' : 's'}.`;
                      }
                      Alert.alert('Please wait', msgText);
                    } else {
                      Alert.alert('Failed', msg);
                    }
                  } finally {
                    setChecking(false);
                  }
                }}
                disabled={checking}
              >
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </Pressable>
            )}
            {/* Buttons */}
            <Pressable
              style={[styles.primaryButton, { marginBottom: 12 }]}
              onPress={handleProceedAsFan}
            >
              <Text style={styles.primaryButtonText}>Continue as Fan</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#D1D5DB' }]} onPress={handleLogout}>
              <Text style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Log Out</Text>
            </Pressable>

            {/* Polling indicator */}
            {checking && (
              <View style={styles.pollingRow}>
                <ActivityIndicator size="small" color={isDark ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.pollingText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>Checking status...</Text>
              </View>
            )}

            {/* Support */}
            <Text style={[styles.supportText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              Questions? Contact support@varsityhub.app
            </Text>
          </>
        )}

        {approved && (
          <>
            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: '#1B3A6B', marginTop: 24 },
                navigationTarget && { opacity: 0.6 },
              ]}
              onPress={() => { void handleApprovedNavigation('organization'); }}
              disabled={navigationTarget !== null}
            >
              <MaterialIcons name="business" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Continue Coach Setup</Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryButton,
                { borderColor: '#1B3A6B', marginTop: 0 },
                navigationTarget && { opacity: 0.6 },
              ]}
              onPress={() => { void handleApprovedNavigation('create-team'); }}
              disabled={navigationTarget !== null}
            >
              <Text style={[styles.secondaryButtonText, { color: '#1B3A6B' }]}>Create Your First Team</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40 },
  logoText: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  heading: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
  subheading: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32, paddingHorizontal: 12 },
  waitSection: {
    width: '100%', borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 28, gap: 12,
  },
  waitTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulletText: { fontSize: 14, lineHeight: 20 },
  primaryButton: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1B3A6B', paddingVertical: 14, borderRadius: 10, gap: 8, marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    width: '100%', alignItems: 'center', paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, marginBottom: 20,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
  pollingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  pollingText: { fontSize: 12 },
  supportText: { fontSize: 12, textAlign: 'center', marginTop: 'auto', marginBottom: 16 },
  reasonCard: {
    width: '100%', borderRadius: 10, padding: 14, borderWidth: 1, marginBottom: 20, gap: 4,
  },
  reasonLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonText: { fontSize: 14, lineHeight: 20 },
});

export default PendingApproval;
