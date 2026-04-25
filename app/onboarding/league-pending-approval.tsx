import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, useColorScheme, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
// @ts-ignore
import { User, Notification as NotificationApi } from '@/api/entities';
import { httpGet } from '@/api/http';
import { captureException } from '@/utils/sentry';

function LeaguePendingApproval() {
  const router = useRouter();
  const { signOut, checkAuth, registerPushToken } = useAuth();
  const { state: ob } = useOnboarding();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ leagueName?: string; orgId?: string }>();
  const [leagueName, setLeagueName] = useState<string>(() =>
    String(params.leagueName || ob.organization_name || 'this organization').trim() || 'this organization'
  );
  // v1.0.3: orgId is STATE, not a derived const, so it can be hydrated from
  // /me on cold-start when both route params and OnboardingContext are empty.
  // Previously: a user who closed the app mid-approval and reopened would hit
  // the pending screen with an empty orgId, get redirected back to step-3,
  // and appear to "skip screens" in a loop even though the org was already
  // submitted server-side.
  const [orgId, setOrgId] = useState<string>(() =>
    String(params.orgId || ob.organization_id || '').trim()
  );
  const [hydrating, setHydrating] = useState<boolean>(() => {
    return !String(params.orgId || ob.organization_id || '').trim();
  });
  const [isApplicationFlow, setIsApplicationFlow] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const redirectedRef = useRef(false);
  const proceedingAsFanRef = useRef(false);
  const isNavigatingRef = useRef(false);
  const [navigationTarget, setNavigationTarget] = useState<'organization' | 'create-team' | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const redirectToLeagueSetup = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    stopPolling();
    router.replace('/onboarding/coach-application' as any);
  }, [router, stopPolling]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  // v1.0.3: hydrate orgId from /me when it's missing at mount (cold-start
  // race where OnboardingContext hasn't loaded yet). Only redirect back to
  // step-3 if the SERVER truly has no organization_id — otherwise we loop
  // users back to a step they already completed.
  useEffect(() => {
    if (orgId) {
      setHydrating(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me: any = await User.refresh();
        if (cancelled) return;
        const applicationName = String(me?.coach_application?.organization_name || '').trim();
        if (applicationName) setLeagueName(applicationName);
        const accountState = String(me?.account_state || '').trim();
        if (
          accountState === 'coach_application_submitted' ||
          accountState === 'coach_application_rejected' ||
          accountState === 'coach_agreement_required' ||
          accountState === 'coach_final_setup_required'
        ) {
          setIsApplicationFlow(true);
          setHydrating(false);
          return;
        }
        setIsApplicationFlow(false);
        const fromServer = String(
          me?.organization_id || me?.preferences?.organization_id || ''
        ).trim();
        if (fromServer) {
          setOrgId(fromServer);
        } else {
          // Server confirms no org — safe to redirect back to step-3.
          redirectToLeagueSetup();
        }
      } catch {
        // Network failure — don't redirect. Let the user see the waiting
        // screen with a "Continue as Fan" escape rather than ping-ponging
        // back to step-3 where they'd have to re-upload everything.
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, redirectToLeagueSetup]);

  // Poll organization status every 30 seconds for legacy org-backed pending flows.
  const checkApproval = useCallback(async () => {
    try {
      setChecking(true);
      const me: any = await User.refresh().catch(() => null);
      const accountState = String(me?.account_state || '').trim();
      const applicationName = String(me?.coach_application?.organization_name || '').trim();
      if (applicationName) setLeagueName(applicationName);

      if (accountState === 'coach_application_submitted') {
        setIsApplicationFlow(true);
        setApproved(false);
        setRejected(false);
        stopPolling();
        return;
      }

      if (accountState === 'coach_application_rejected') {
        setIsApplicationFlow(true);
        setRejected(true);
        stopPolling();
        try {
          const page = await NotificationApi.listPage(null, 20, false);
          const rejectionNotif = Array.isArray(page?.items)
            ? page.items.find((n: any) => (n.type === 'COACH_REJECTED' || n.type === 'ORG_REJECTED') && n.meta?.reason)
            : null;
          if (rejectionNotif?.meta?.reason) {
            setRejectionReason(rejectionNotif.meta.reason);
          }
        } catch {
          // best-effort
        }
        return;
      }

      if (accountState === 'coach_agreement_required' || accountState === 'coach_final_setup_required') {
        setIsApplicationFlow(true);
        setApproved(true);
        stopPolling();
        return;
      }

      setIsApplicationFlow(false);

      if (!orgId) {
        redirectToLeagueSetup();
        return;
      }

      const org: any = await httpGet(`/organizations/${orgId}`);
      const role = String(me?.role || me?.preferences?.role || '').toLowerCase();
      const approvalStatus = String(me?.approval_status || '').toUpperCase();
      const isProceedingAsFan = me?.preferences?.proceeding_as_fan === true || role === 'fan';
      if (isProceedingAsFan || proceedingAsFanRef.current) {
        stopPolling();
        return;
      }
      const orgState = String(org?.status || '').toLowerCase();
      const canViewPendingApproval =
        role === 'coach' &&
        (approvalStatus === 'PENDING' || approvalStatus === 'APPROVED' || approvalStatus === 'REJECTED') &&
        Boolean(org?.id) &&
        (orgState === '' || orgState === 'pending' || orgState === 'approved' || orgState === 'rejected' || org?.admin_approved === true);

      if (!canViewPendingApproval) {
        redirectToLeagueSetup();
        return;
      }

      const isRejected = org?.status === 'rejected' || me?.approval_status === 'REJECTED';
      if (isRejected) {
        setRejected(true);
        stopPolling();
        // Fetch rejection reason from notifications
        try {
          const page = await NotificationApi.listPage(null, 20, false);
          const rejectionNotif = Array.isArray(page?.items)
            ? page.items.find((n: any) => (n.type === 'COACH_REJECTED' || n.type === 'ORG_REJECTED') && n.meta?.reason)
            : null;
          if (rejectionNotif?.meta?.reason) {
            setRejectionReason(rejectionNotif.meta.reason);
          }
        } catch {
          // best-effort
        }
        return;
      }
      // Legacy org-backed approval path.
      if (org?.admin_approved === true || me?.approval_status === 'APPROVED') {
        setApproved(true);
        stopPolling();
        // Approval only unlocks real coach setup. Do not mark onboarding complete here.
        registerPushToken().catch(() => {});
      }
    } catch {
      // ignore polling errors
    } finally {
      setChecking(false);
    }
  }, [orgId, redirectToLeagueSetup, stopPolling]);

  useEffect(() => {
    void checkApproval();
    // v1.0.3: poll every 30s (was 60s) — see pending-approval.tsx for rationale.
    intervalRef.current = setInterval(() => void checkApproval(), 30000);
    // Stop polling after 30 minutes — admin has been notified, user should continue as fan
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setTimedOut(true);
    }, 30 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [checkApproval, orgId]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      if (__DEV__) console.warn('[league-pending-approval] Logout failed:', (err as Error)?.message ?? err);
    }
    router.replace('/sign-in');
  };

  const handleProceedAsFan = async () => {
    try {
      proceedingAsFanRef.current = true;
      stopPolling();
      await User.updatePreferences({ proceeding_as_fan: true });
      await checkAuth();
      router.replace('/(tabs)' as any);
    } catch (err) {
      proceedingAsFanRef.current = false;
      if (__DEV__) console.warn('[league-pending-approval] Failed to proceed as fan:', err);
      captureException(err instanceof Error ? err : new Error(String(err)), {
        tags: { component: 'LeaguePendingApproval', action: 'proceedAsFan' },
      });
      Alert.alert('Setup Issue', 'Could not complete setup. Please check your connection and try again. If this persists, try signing out and back in.');
    }
  };

  const handleApprovedNavigation = useCallback(async (redirect: 'organization' | 'create-team') => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setNavigationTarget(redirect);
    try {
      await checkAuth();
      router.replace({ pathname: '/onboarding/coach-agreement', params: { redirect } } as any);
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

        {/* Status checkmark */}
        <View style={[styles.iconCircle, {
          backgroundColor: rejected
            ? (isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2')
            : approved
              ? (isDark ? 'rgba(218,165,32,0.15)' : '#FFF7ED')
              : (isDark ? 'rgba(156,163,175,0.15)' : '#F3F4F6')
        }]}>
          <MaterialIcons
            name={rejected ? 'close' : 'verified'}
            size={56}
            color={rejected ? '#DC2626' : approved ? '#D4A017' : '#9CA3AF'}
          />
        </View>

        {/* Heading */}
        <Text style={[styles.heading, { color: isDark ? '#F9FAFB' : '#111827' }]}>
          {rejected ? (isApplicationFlow ? 'Application Not Approved' : 'League Not Approved') : approved ? 'Application Approved' : 'Submitted to VarsityHub for Review'}
        </Text>

        {/* Subheading */}
        <Text style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          {rejected
            ? isApplicationFlow
              ? `Your coach application for "${leagueName}" was not approved.${rejectionReason ? '' : ' You can try again later or continue as a fan. Contact support@varsityhub.app for questions.'}`
              : `"${leagueName}" was not approved.${rejectionReason ? '' : ' You can try creating a new league or continue as a fan. Contact support@varsityhub.app for questions.'}`
            : approved
              ? isApplicationFlow
                ? `Your application for "${leagueName}" was approved. Continue to accept the coach agreement and finish setting up your real organization.`
                : `"${leagueName}" is approved. Continue to accept the coach agreement and finish coach setup.`
              : `VarsityHub is reviewing "${leagueName}". This usually takes less than 24 hours. You'll receive an email when your league is approved and ready.`
          }
        </Text>

        {/* Show rejection reason if available */}
        {rejected && rejectionReason ? (
          <View style={[styles.reasonCard, { backgroundColor: isDark ? 'rgba(220,38,38,0.1)' : '#FEF2F2', borderColor: isDark ? '#7F1D1D' : '#FECACA' }]}>
            <Text style={[styles.reasonLabel, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>Reason:</Text>
            <Text style={[styles.reasonText, { color: isDark ? '#F9FAFB' : '#111827' }]}>{rejectionReason}</Text>
            <Text style={[styles.reasonText, { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 8, fontSize: 13 }]}>
              You can try creating a new league or continue as a fan. Contact support@varsityhub.app for questions.
            </Text>
          </View>
        ) : null}

        {!orgId && hydrating ? (
          // v1.0.3: while we're hydrating orgId from /me, show a spinner
          // instead of the red "missing" error. Prevents the flash of
          // "please return to league setup" on cold-start before the
          // server data loads.
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text style={[styles.supportText, { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 8 }]}>
              Loading your application…
            </Text>
          </View>
        ) : null}

        {!orgId && !hydrating && !isApplicationFlow && !approved && !rejected ? (
          <>
            <Text style={[styles.supportText, { color: '#EF4444', marginTop: 0, marginBottom: 12 }]}>
              Organization ID is missing for this account. You can retry the setup or continue as a fan for now.
            </Text>
            <Pressable
              style={[styles.primaryButton, { marginBottom: 12 }]}
              onPress={handleProceedAsFan}
            >
              <Text style={styles.primaryButtonText}>Continue as Fan</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#D1D5DB' }]}
              onPress={() => router.replace('/onboarding/coach-application' as any)}
            >
              <Text style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Back to Organization Setup</Text>
            </Pressable>
          </>
        ) : null}

        {rejected && (
          <>
            <Pressable
              style={[styles.primaryButton, { marginBottom: 12 }]}
              onPress={async () => {
                if (isApplicationFlow) {
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
                  return;
                }

                router.replace('/onboarding/coach-application' as any);
              }}
              disabled={checking}
            >
              <Text style={styles.primaryButtonText}>{isApplicationFlow ? 'Try Again' : 'Back to Organization Setup'}</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#D1D5DB' }]}
              onPress={handleProceedAsFan}
            >
              <Text style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Continue as Fan</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#D1D5DB' }]} onPress={handleLogout}>
              <Text style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Log Out</Text>
            </Pressable>
            <Text style={[styles.supportText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              Questions? Contact support@varsityhub.app
            </Text>
          </>
        )}

        {timedOut && !approved && !rejected && (orgId || isApplicationFlow) && (
          <>
            <Text style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 20 }]}>
              This is taking longer than usual. We'll email you when your league is approved. You can continue as a fan in the meantime.
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

        {!approved && !rejected && !timedOut && (orgId || isApplicationFlow) && (
          <>
            <View style={[styles.infoCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? '#374151' : '#D1D5DB' }]}>
              <View style={styles.infoRow}>
                <MaterialIcons name="business" size={18} color={isDark ? '#60A5FA' : '#2563EB'} />
                <Text style={[styles.infoLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  {isApplicationFlow ? 'Application:' : 'Organization:'}
                </Text>
                <Text style={[styles.infoValue, { color: isDark ? '#F9FAFB' : '#111827' }]}>{leagueName}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="schedule" size={18} color={isDark ? '#60A5FA' : '#2563EB'} />
                <Text style={[styles.infoLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Estimated:</Text>
                <Text style={[styles.infoValue, { color: isDark ? '#F9FAFB' : '#111827' }]}>Within 24 hours</Text>
              </View>
            </View>

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
              <MaterialIcons name={orgId ? 'business' : 'arrow-forward'} size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Continue Coach Setup</Text>
            </Pressable>
            {orgId ? (
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
            ) : null}
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
  subheading: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28, paddingHorizontal: 12 },
  infoCard: {
    width: '100%', borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 16, gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 13, fontWeight: '600' },
  infoValue: { fontSize: 13, fontWeight: '700', flex: 1 },
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

export default LeaguePendingApproval;
