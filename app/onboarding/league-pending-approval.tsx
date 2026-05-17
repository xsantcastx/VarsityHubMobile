import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, ScrollView, Text, View, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import { getPostAuthRouteDecision } from '@/utils/appRouteDecisions';
// @ts-ignore
import { User, Notification as NotificationApi, Organization } from '@/api/entities';
import { captureException } from '@/utils/sentry';
import {
  CoachSetupActions,
  FanFallbackActions,
  InfoCardRow,
  PendingApprovalShell,
  PrimaryButton,
  ReasonCard,
  SecondaryButton,
  pendingApprovalStyles as styles,
} from '@/components/onboarding/pendingApprovalUi';

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
  const approvalCheckInFlightRef = useRef(false);
  const lastLifecycleCheckRef = useRef(0);
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
    void (async () => {
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

      const org: any = await Organization.get(orgId);
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
        void registerPushToken().catch(() => {});
      }
    } catch {
      // ignore polling errors
    } finally {
      approvalCheckInFlightRef.current = false;
      setChecking(false);
    }
  }, [orgId, redirectToLeagueSetup, registerPushToken, stopPolling]);

  useEffect(() => {
    void checkApproval('initial');
    // v1.0.3: poll every 30s (was 60s) — see pending-approval.tsx for rationale.
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
  }, [checkApproval, orgId]);

  useFocusEffect(
    useCallback(() => {
      if (!hydrating) {
        void checkApproval('focus');
      }
    }, [checkApproval, hydrating])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && !hydrating) {
        void checkApproval('foreground');
      }
    });
    return () => {
      subscription.remove();
    };
  }, [checkApproval, hydrating]);

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
      const freshUser = await checkAuth();
      const decision = getPostAuthRouteDecision(freshUser ?? null);
      router.replace(decision.route as any);
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
          heading={
            rejected
              ? isApplicationFlow
                ? 'Application Not Approved'
                : 'League Not Approved'
              : approved
                ? 'Application Approved'
                : 'Submitted to VarsityHub for Review'
          }
          subheading={
            rejected
              ? isApplicationFlow
                ? `Your coach application for "${leagueName}" was not approved.${rejectionReason ? '' : ' You can try again later or continue as a fan. Contact support@varsityhub.app for questions.'}`
                : `"${leagueName}" was not approved.${rejectionReason ? '' : ' You can try creating a new league or continue as a fan. Contact support@varsityhub.app for questions.'}`
              : approved
                ? isApplicationFlow
                  ? `Your application for "${leagueName}" was approved. Continue to accept the coach agreement and finish setting up your real organization.`
                  : `"${leagueName}" is approved. Continue to accept the coach agreement and finish coach setup.`
                : `VarsityHub is reviewing "${leagueName}". This usually takes less than 24 hours. You'll receive an email when your league is approved and ready.`
          }
        >

          {rejected && rejectionReason ? (
            <ReasonCard
              isDark={isDark}
              body={rejectionReason}
              footer="You can try creating a new league or continue as a fan. Contact support@varsityhub.app for questions."
            />
          ) : null}

          {!orgId && hydrating ? (
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <ActivityIndicator color={isDark ? '#60A5FA' : '#2563EB'} />
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
              <PrimaryButton label="Continue as Fan" onPress={handleProceedAsFan} style={{ marginBottom: 12 }} />
              <SecondaryButton
                label="Back to Organization Setup"
                onPress={() => router.replace('/onboarding/coach-application' as any)}
                borderColor={isDark ? '#374151' : '#D1D5DB'}
                color={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </>
          ) : null}

          {rejected && (
            <>
              <PrimaryButton
                label={isApplicationFlow ? 'Try Again' : 'Back to Organization Setup'}
                onPress={() => {
                  void (async () => {
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
                  })();
                }}
                disabled={checking}
                style={{ marginBottom: 12 }}
              />
              <FanFallbackActions isDark={isDark} onProceedAsFan={handleProceedAsFan} onLogout={handleLogout} />
            </>
          )}

          {timedOut && !approved && !rejected && (orgId || isApplicationFlow) && (
            <>
              <Text style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 20 }]}>
                This is taking longer than usual. We'll email you when your league is approved. You can continue as a fan in the meantime.
              </Text>
              <FanFallbackActions isDark={isDark} onProceedAsFan={handleProceedAsFan} onLogout={handleLogout} />
            </>
          )}

          {!approved && !rejected && !timedOut && (orgId || isApplicationFlow) && (
            <>
              <View style={[styles.infoCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? '#374151' : '#D1D5DB' }]}>
                <InfoCardRow
                  isDark={isDark}
                  icon="business"
                  label={isApplicationFlow ? 'Application:' : 'Organization:'}
                  value={leagueName}
                />
                <InfoCardRow isDark={isDark} icon="schedule" label="Estimated:" value="Within 24 hours" />
              </View>

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
              onCreateTeam={
                orgId
                  ? () => {
                      void handleApprovedNavigation('create-team');
                    }
                  : undefined
              }
              disabled={navigationTarget !== null}
              primaryIcon={<MaterialIcons name={orgId ? 'business' : 'arrow-forward'} size={20} color="#fff" />}
            />
          )}
        </PendingApprovalShell>
      </ScrollView>
    </SafeAreaView>
  );
}

export default LeaguePendingApproval;
