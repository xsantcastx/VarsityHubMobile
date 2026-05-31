import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, useColorScheme, ActivityIndicator } from 'react-native';
import { Organization, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import {
  getCanonicalOrganizationId,
  getCanonicalRole,
  isProceedingAsFanSnapshot,
} from '@/utils/authState';
import {
  fetchRejectionReason,
  getPendingApprovalAuthSnapshot,
  reapplyCoachApplication,
  usePendingApprovalActions,
  usePendingApprovalPolling,
} from '@/hooks/usePendingApprovalFlow';
import { captureException } from '@/utils/sentry';
import {
  CoachSetupActions,
  FanFallbackActions,
  InfoCardRow,
  PendingApprovalScreenScaffold,
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
  const [leagueName, setLeagueName] = useState<string>(
    () =>
      String(params.leagueName || ob.organization_name || 'this organization').trim() ||
      'this organization'
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
  const redirectedRef = useRef(false);
  const proceedingAsFanRef = useRef(false);

  const { stopPolling } = usePendingApprovalPolling({
    setChecking,
    setTimedOut,
    skipLifecycleChecks: hydrating,
    onCheck: async () => {
      try {
        const { user: me, decision } = await getPendingApprovalAuthSnapshot(checkAuth);
        if (!me) return;
        if (decision.route === '/onboarding/pending-approval') {
          stopPolling();
          router.replace(decision.route as any);
          return;
        }
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
          setRejectionReason(await fetchRejectionReason(['COACH_REJECTED', 'ORG_REJECTED']));
          return;
        }

        if (
          accountState === 'coach_agreement_required' ||
          accountState === 'coach_final_setup_required'
        ) {
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
        const role = String(getCanonicalRole(me) || '').toLowerCase();
        const approvalStatus = String(me?.approval_status || '').toUpperCase();
        const isProceedingAsFan = isProceedingAsFanSnapshot(me);
        if (isProceedingAsFan || proceedingAsFanRef.current) {
          stopPolling();
          return;
        }
        const orgState = String(org?.status || '').toLowerCase();
        const canViewPendingApproval =
          role === 'coach' &&
          (approvalStatus === 'PENDING' ||
            approvalStatus === 'APPROVED' ||
            approvalStatus === 'REJECTED') &&
          Boolean(org?.id) &&
          (orgState === '' ||
            orgState === 'pending' ||
            orgState === 'approved' ||
            orgState === 'rejected' ||
            org?.admin_approved === true);

        if (!canViewPendingApproval) {
          redirectToLeagueSetup();
          return;
        }

        const isRejected = org?.status === 'rejected' || me?.approval_status === 'REJECTED';
        if (isRejected) {
          setRejected(true);
          stopPolling();
          setRejectionReason(await fetchRejectionReason(['COACH_REJECTED', 'ORG_REJECTED']));
          return;
        }
        if (org?.admin_approved === true || me?.approval_status === 'APPROVED') {
          setApproved(true);
          stopPolling();
          void registerPushToken().catch(() => {});
        }
      } catch {
        // ignore polling errors
      }
    },
  });
  const redirectToLeagueSetup = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    stopPolling();
    router.replace('/onboarding/coach-application' as any);
  }, [router, stopPolling]);
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
        const { user: me, decision } = await getPendingApprovalAuthSnapshot(checkAuth);
        if (!me) return;
        if (decision.route === '/onboarding/pending-approval') {
          stopPolling();
          router.replace(decision.route as any);
          return;
        }
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
        const fromServer = String(getCanonicalOrganizationId(me) || '').trim();
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
  }, [checkAuth, orgId, redirectToLeagueSetup, router, stopPolling]);
  const { navigationTarget, handleLogout, handleProceedAsFan, handleApprovedNavigation } =
    usePendingApprovalActions({
      replaceRoute: route => router.replace(route),
      signOut,
      checkAuth,
      stopPolling,
      logPrefix: 'league-pending-approval',
      proceedingAsFanRef,
      persistProceedAsFan: async () => {
        await User.updatePreferences({ proceeding_as_fan: true });
      },
      onProceedAsFanError: err => {
        captureException(err instanceof Error ? err : new Error(String(err)), {
          tags: { component: 'LeaguePendingApproval', action: 'proceedAsFan' },
        });
      },
      formatProceedAsFanError: () => ({
        title: 'Setup Issue',
        message:
          'Could not complete setup. Please check your connection and try again. If this persists, try signing out and back in.',
      }),
    });

  return (
    <PendingApprovalScreenScaffold
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
        <>
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <ActivityIndicator color={isDark ? '#60A5FA' : '#2563EB'} />
            <Text
              style={[styles.supportText, { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 8 }]}
            >
              Loading your application…
            </Text>
          </View>
          <FanFallbackActions
            isDark={isDark}
            onProceedAsFan={handleProceedAsFan}
            onLogout={handleLogout}
            supportText="You can continue as a fan right now while we load your application."
          />
        </>
      ) : null}

      {!orgId && !hydrating && !isApplicationFlow && !approved && !rejected ? (
        <>
          <Text style={[styles.supportText, { color: '#EF4444', marginTop: 0, marginBottom: 12 }]}>
            Organization ID is missing for this account. You can retry the setup or continue as a
            fan for now.
          </Text>
          <PrimaryButton
            label="Continue as Fan"
            onPress={handleProceedAsFan}
            style={{ marginBottom: 12 }}
          />
          <SecondaryButton
            label="Back to Organization Setup"
            onPress={() => router.replace('/onboarding/coach-application' as any)}
            borderColor={Colors[colorScheme].border}
            color={isDark ? '#9CA3AF' : '#6B7280'}
          />
        </>
      ) : null}

      {rejected && (
        <>
          <PrimaryButton
            label={isApplicationFlow ? 'Try Again' : 'Back to Organization Setup'}
            onPress={() => {
              if (!isApplicationFlow) {
                router.replace('/onboarding/coach-application' as any);
                return;
              }

              void reapplyCoachApplication({
                setChecking,
                setRejected,
                setRejectionReason,
                onSuccess: () => {
                  router.replace('/onboarding/coach-application' as any);
                },
              });
            }}
            disabled={checking}
            style={{ marginBottom: 12 }}
          />
          <FanFallbackActions
            isDark={isDark}
            onProceedAsFan={handleProceedAsFan}
            onLogout={handleLogout}
          />
        </>
      )}

      {timedOut && !approved && !rejected && (orgId || isApplicationFlow) && (
        <>
          <Text
            style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 20 }]}
          >
            This is taking longer than usual. We'll email you when your league is approved. You can
            continue as a fan in the meantime.
          </Text>
          <FanFallbackActions
            isDark={isDark}
            onProceedAsFan={handleProceedAsFan}
            onLogout={handleLogout}
          />
        </>
      )}

      {!approved && !rejected && !timedOut && (orgId || isApplicationFlow) && (
        <>
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                borderColor: isDark ? '#374151' : '#D1D5DB',
              },
            ]}
          >
            <InfoCardRow
              isDark={isDark}
              icon="business"
              label={isApplicationFlow ? 'Application:' : 'Organization:'}
              value={leagueName}
            />
            <InfoCardRow
              isDark={isDark}
              icon="schedule"
              label="Estimated:"
              value="Within 24 hours"
            />
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
          primaryIcon={
            <MaterialIcons name={orgId ? 'business' : 'arrow-forward'} size={20} color="#fff" />
          }
        />
      )}
    </PendingApprovalScreenScaffold>
  );
}

export default LeaguePendingApproval;
