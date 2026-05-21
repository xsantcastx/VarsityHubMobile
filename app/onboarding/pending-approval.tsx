import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, ScrollView, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User, Notification as NotificationApi } from '@/api/entities';
import { getPostAuthRouteDecision } from '@/utils/appRouteDecisions';
import { getCanonicalOrganizationId, getCanonicalRole, isProceedingAsFanSnapshot } from '@/utils/authState';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import {
  CoachSetupActions,
  FanFallbackActions,
  PendingApprovalShell,
  PrimaryButton,
  ReasonCard,
  pendingApprovalStyles as styles,
} from '@/components/onboarding/pendingApprovalUi';

function PendingApproval() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { signOut, checkAuth, registerPushToken } = useAuth();
  const { state: ob } = useOnboarding();
  const params = useLocalSearchParams<{ leagueName?: string; ownerName?: string }>();
  const leagueName = params.leagueName || 'this organization';
  const ownerName = params.ownerName || 'the league owner';
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [, setOrgId] = useState<string | null>(null);
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

  // Poll /me every 30 seconds and always bypass the client TTL cache.
  // Approval is granted by another actor, so a cached snapshot defeats the
  // whole point of the waiting screen.
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
      const me: any = await User.refresh();
      const role = String(getCanonicalRole(me) || '').toLowerCase();
      const approvalStatus = String(me?.approval_status || '').toUpperCase();
      const isProceedingAsFan = isProceedingAsFanSnapshot(me) || role === 'fan';
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
        const resolvedOrgId = getCanonicalOrganizationId(me) || ob.organization_id || null;
        if (resolvedOrgId) setOrgId(resolvedOrgId);
        stopPolling();
        // Do not auto-complete coach onboarding here. Approval only unlocks
        // the real coach setup flow; the user still needs agreement + setup.
        void registerPushToken().catch(() => {});
      }
    } catch {
      // ignore polling errors
    } finally {
      approvalCheckInFlightRef.current = false;
      setChecking(false);
    }
  }, [ob.organization_id, redirectToOnboarding, registerPushToken, stopPolling]);

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
      await User.updatePreferences({ proceeding_as_fan: true, role: 'fan' });
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
        <PendingApprovalShell
          isDark={isDark}
          status={rejected ? 'rejected' : approved ? 'approved' : 'pending'}
          heading={rejected ? 'Application Not Approved' : approved ? 'You\'re Approved!' : 'Application Submitted'}
          subheading={
            rejected
              ? `Your request to join "${leagueName}" was not approved.${rejectionReason ? '' : ' You can continue as a fan or try joining a different league.'}`
              : approved
                ? `Your request to join "${leagueName}" was approved. Continue to accept the coach agreement and finish coach setup.`
                : `Your request to join "${leagueName}" has been sent to ${ownerName}. You'll receive a notification when approved — typically within a few hours. You can use the app as a fan while you wait.`
          }
        >

          {rejected ? (
            <ReasonCard
              isDark={isDark}
              body={
                rejectionReason || 'No reason provided. You can continue as a fan or try joining a different league.'
              }
            />
          ) : null}

          {timedOut && !approved && !rejected && (
            <>
              <Text style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 20 }]}>
                This is taking longer than usual. We'll email you when your application is reviewed. You can continue as a fan in the meantime.
              </Text>
              <FanFallbackActions isDark={isDark} onProceedAsFan={handleProceedAsFan} onLogout={handleLogout} />
            </>
          )}

          {(!approved || rejected) && !timedOut && (
            <>
              {rejected && (
                <PrimaryButton
                  label="Try Again"
                  onPress={() => {
                    void (async () => {
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
                    })();
                  }}
                  disabled={checking}
                  style={{ marginBottom: 12, backgroundColor: '#1B3A6B' }}
                />
              )}
              <FanFallbackActions
                isDark={isDark}
                onProceedAsFan={handleProceedAsFan}
                onLogout={handleLogout}
                checking={checking}
              />
            </>
          )}

          {approved && (
            <CoachSetupActions
              onContinueSetup={() => {
                void handleApprovedNavigation('organization');
              }}
              onCreateTeam={() => {
                void handleApprovedNavigation('create-team');
              }}
              disabled={navigationTarget !== null}
              primaryIcon={<MaterialIcons name="business" size={20} color="#fff" />}
            />
          )}
        </PendingApprovalShell>
      </ScrollView>
    </SafeAreaView>
  );
}

export default PendingApproval;
