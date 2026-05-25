import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, useColorScheme } from 'react-native';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import { captureBreadcrumb, captureException } from '@/utils/sentry';
import {
  fetchRejectionReason,
  getPendingApprovalAuthSnapshot,
  reapplyCoachApplication,
  usePendingApprovalActions,
  usePendingApprovalPolling,
} from '@/hooks/usePendingApprovalFlow';
import {
  CoachSetupActions,
  FanFallbackActions,
  PendingApprovalScreenScaffold,
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
  const redirectedRef = useRef(false);
  const proceedingAsFanRef = useRef(false);
  const { stopPolling } = usePendingApprovalPolling({
    setChecking,
    setTimedOut,
    onCheck: async () => {
      try {
        const { user: me, decision } = await getPendingApprovalAuthSnapshot(checkAuth);
        if (!me) return;
        if (decision.route === '/onboarding/league-pending-approval') {
          stopPolling();
          router.replace(decision.route as any);
          return;
        }
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
          setRejectionReason(await fetchRejectionReason(['COACH_REJECTED']));
          return;
        }
        if (me?.approval_status === 'APPROVED') {
          setApproved(true);
          const resolvedOrgId = me?.preferences?.organization_id || ob.organization_id || null;
          if (resolvedOrgId) setOrgId(resolvedOrgId);
          stopPolling();
          void registerPushToken().catch(() => {});
        }
      } catch {
        // ignore polling errors
      }
    },
  });
  const redirectToOnboarding = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    stopPolling();
    router.replace('/onboarding');
  }, [router, stopPolling]);
  const {
    navigationTarget,
    handleLogout,
    handleProceedAsFan,
    handleApprovedNavigation,
  } = usePendingApprovalActions({
    replaceRoute: route => router.replace(route),
    signOut,
    checkAuth,
    stopPolling,
    logPrefix: 'pending-approval',
    proceedingAsFanRef,
  });

  return (
    <PendingApprovalScreenScaffold
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
    </PendingApprovalScreenScaffold>
  );
}

export default PendingApproval;
