import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User, Notification as NotificationApi } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';

function PendingApproval() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { signOut, markOnboardingCompleteLocally, checkAuth, registerPushToken } = useAuth();
  const { state: ob } = useOnboarding();
  const params = useLocalSearchParams<{ leagueName?: string; ownerName?: string }>();
  const leagueName = params.leagueName || 'the league';
  const ownerName = params.ownerName || 'the league admin';
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll /me every 30 seconds to check approval_status
  const checkApproval = useCallback(async () => {
    try {
      setChecking(true);
      setCompletionError(null);
      const me: any = await User.me();
      if (me?.approval_status === 'REJECTED') {
        setRejected(true);
        if (typeof me?.approval_reason === 'string' && me.approval_reason.trim()) {
          setRejectionReason(me.approval_reason.trim());
        }
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        // Fetch rejection reason from the most recent COACH_REJECTED notification
        try {
          const page = await NotificationApi.listPage(null, 20, false);
          const rejectionNotif = Array.isArray(page?.items)
            ? page.items.find((n: any) => n.type === 'COACH_REJECTED' && n.meta?.reason)
            : null;
          if (!me?.approval_reason && rejectionNotif?.meta?.reason) {
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
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        // Complete onboarding on server, then go to main app.
        // If completion fails, stay here and show a retry state instead of redirect loops.
        let completed = false;
        let completeOnboardingErr: any = null;
        try {
          // Use server data (me) as primary source, fall back to local state (ob)
          const mePrefs = me?.preferences || {};
          await User.completeOnboarding({
            role: 'coach',
            proceeding_as_fan: false,
            username: me?.username || ob.username || mePrefs.username,
            dob: me?.dob || ob.dob || mePrefs.dob,
            zip_code: me?.zip_code || ob.zip_code || ob.zip || mePrefs.zip_code,
            affiliation: mePrefs.affiliation || ob.affiliation,
            organization_id: mePrefs.organization_id || ob.organization_id,
            organization_name: mePrefs.organization_name || ob.organization_name,
            plan: mePrefs.plan || (ob as any).plan || 'rookie',
            team_id: mePrefs.team_id || (ob as any).team_id,
            team_name: mePrefs.team_name || (ob as any).team_name,
          });
          // Server has recorded completion — this is the source of truth.
          // markOnboardingCompleteLocally + checkAuth are local state syncs; their
          // failure does NOT mean onboarding is incomplete on the server.
          completed = true;
          await markOnboardingCompleteLocally();
          // Do NOT call checkAuth() here — it triggers AuthProvider redirect
          // before the user sees "You're Approved!" and the action buttons.
          // checkAuth() is called when the user taps a button to proceed.
          registerPushToken().catch(() => {});
        } catch (err: any) {
          if (__DEV__) console.warn('[pending-approval] Failed to complete onboarding:', err);
          if (!completed) {
            completeOnboardingErr = err;
          }
        }
        if (!completed) {
          try {
            // Fallback: try setting onboarding_completed directly via preferences
            await User.updatePreferences({ onboarding_completed: true });
            await markOnboardingCompleteLocally();
            completed = true;
          } catch {
            // Final check: maybe onboarding was already completed server-side
            try {
              const refreshed: any = await User.me();
              if (refreshed?.preferences?.onboarding_completed === true) {
                await markOnboardingCompleteLocally();
                completed = true;
              }
            } catch {
              // ignore follow-up check failures
            }
          }
        }
        if (!completed) {
          const errMsg = completeOnboardingErr?.message;
          const userFacingMsg =
            errMsg && errMsg.length < 200 && !/^HTTP \d/.test(errMsg)
              ? errMsg
              : 'Approval is complete, but final account setup failed. Tap retry below.';
          setCompletionError(userFacingMsg);
          return;
        }
        // Don't auto-redirect — let user tap Continue when ready
      }
    } catch {
      // ignore polling errors
    } finally {
      setChecking(false);
    }
  }, [
    markOnboardingCompleteLocally,
    ob.affiliation,
    ob.dob,
    ob.organization_id,
    ob.organization_name,
    ob.username,
    ob.zip,
    ob.zip_code,
    router,
  ]);

  useEffect(() => {
    // Initial check
    void checkApproval();
    // Poll every 10 seconds for faster approval feedback
    intervalRef.current = setInterval(() => void checkApproval(), 10000);
    // Stop polling after 30 minutes — admin has been notified, user should continue as fan
    timeoutRef.current = setTimeout(
      () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTimedOut(true);
      },
      30 * 60 * 1000
    );
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [checkApproval]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      if (__DEV__)
        console.warn('[pending-approval] Logout failed:', (err as Error)?.message ?? err);
    }
    router.replace('/sign-in');
  };

  const handleProceedAsFan = async () => {
    try {
      const me: any = await User.me().catch(() => null);
      await User.completeOnboarding({
        role: 'fan',
        username: me?.username || ob.username,
        dob: me?.dob || ob.dob,
        zip_code: me?.zip_code || ob.zip_code || ob.zip,
        affiliation: me?.preferences?.affiliation || ob.affiliation,
        proceeding_as_fan: true,
      });
      await markOnboardingCompleteLocally();
      await checkAuth();
      router.replace('/(tabs)' as any);
    } catch (err) {
      if (__DEV__) console.warn('[pending-approval] Failed to proceed as fan:', err);
      Alert.alert('Failed', 'Could not complete setup. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1120' : '#F8FAFC' }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={{ width: 32, height: 32 }}
            contentFit="contain"
          />
          <Text style={[styles.logoText, { color: isDark ? '#F9FAFB' : '#111827' }]}>
            VarsityHub
          </Text>
        </View>

        {/* Icon */}
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: rejected
                ? isDark
                  ? 'rgba(220,38,38,0.15)'
                  : '#FEE2E2'
                : approved
                  ? isDark
                    ? 'rgba(22,163,74,0.15)'
                    : '#D1FAE5'
                  : isDark
                    ? 'rgba(218,165,32,0.15)'
                    : '#FEF9C3',
            },
          ]}
        >
          <Image
            source={require('../../assets/images/logo.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
        </View>

        {/* Heading */}
        <Text style={[styles.heading, { color: isDark ? '#F9FAFB' : '#111827' }]}>
          {rejected
            ? 'Application Not Approved'
            : approved
              ? "You're Approved!"
              : 'Application Submitted'}
        </Text>

        {/* Subheading */}
        <Text style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          {rejected
            ? `Your request to join "${leagueName}" was not approved.${rejectionReason ? '' : ' You can continue as a fan or try joining a different league.'}`
            : approved
              ? `Welcome to ${leagueName}! Your coach account is ready. Start by viewing your organization or creating your first team.`
              : `Your request to join "${leagueName}" has been sent to ${ownerName}. You'll receive a notification when approved — typically within a few hours. You can use the app as a fan while you wait.`}
        </Text>

        {/* Show rejection reason if available */}
        {rejected ? (
          <View
            style={[
              styles.reasonCard,
              {
                backgroundColor: isDark ? 'rgba(220,38,38,0.1)' : '#FEF2F2',
                borderColor: isDark ? '#7F1D1D' : '#FECACA',
              },
            ]}
          >
            <Text style={[styles.reasonLabel, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
              Reason:
            </Text>
            <Text style={[styles.reasonText, { color: isDark ? '#F9FAFB' : '#111827' }]}>
              {rejectionReason ||
                'No reason provided. You can continue as a fan or try joining a different league.'}
            </Text>
          </View>
        ) : null}

        {timedOut && !approved && !rejected && (
          <>
            <Text
              style={[
                styles.subheading,
                { color: isDark ? '#9CA3AF' : '#6B7280', marginBottom: 20 },
              ]}
            >
              This is taking longer than usual. We'll email you when your application is reviewed.
              You can continue as a fan in the meantime.
            </Text>
            <Pressable
              style={[styles.primaryButton, { marginBottom: 12 }]}
              onPress={handleProceedAsFan}
            >
              <Text style={styles.primaryButtonText}>Continue as Fan</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#D1D5DB' }]}
              onPress={handleLogout}
            >
              <Text style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                Log Out
              </Text>
            </Pressable>
            <Text style={[styles.supportText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              Questions? Contact support@varsityhub.app
            </Text>
          </>
        )}

        {(!approved || rejected) && !timedOut && (
          <>
            {/* Buttons */}
            <Pressable
              style={[styles.primaryButton, { marginBottom: 12 }]}
              onPress={handleProceedAsFan}
            >
              <Text style={styles.primaryButtonText}>Continue as Fan</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#D1D5DB' }]}
              onPress={handleLogout}
            >
              <Text style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                Log Out
              </Text>
            </Pressable>

            {/* Polling indicator */}
            {checking && (
              <View style={styles.pollingRow}>
                <ActivityIndicator size="small" color={isDark ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.pollingText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                  Checking status...
                </Text>
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
            {completionError ? (
              <>
                <Text
                  style={[styles.supportText, { color: '#EF4444', marginTop: 16, marginBottom: 8 }]}
                >
                  {completionError}
                </Text>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    { borderColor: isDark ? '#374151' : '#D1D5DB', marginBottom: 12 },
                  ]}
                  onPress={() => {
                    void checkApproval();
                  }}
                >
                  <Text
                    style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}
                  >
                    Retry Setup
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: '#1B3A6B', marginTop: 24 }]}
                  onPress={async () => {
                    await checkAuth();
                    router.replace({
                      pathname: '/onboarding/coach-agreement',
                      params: { redirect: 'organization' },
                    } as any);
                  }}
                >
                  <MaterialIcons name="business" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>View Your Organization</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, { borderColor: '#1B3A6B', marginTop: 0 }]}
                  onPress={async () => {
                    await checkAuth();
                    router.replace({
                      pathname: '/onboarding/coach-agreement',
                      params: { redirect: 'create-team' },
                    } as any);
                  }}
                >
                  <Text style={[styles.secondaryButtonText, { color: '#1B3A6B' }]}>
                    Create Your First Team
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40 },
  logoText: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  waitSection: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 28,
    gap: 12,
  },
  waitTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulletText: { fontSize: 14, lineHeight: 20 },
  primaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B3A6B',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
  pollingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  pollingText: { fontSize: 12 },
  supportText: { fontSize: 12, textAlign: 'center', marginTop: 'auto', marginBottom: 16 },
  reasonCard: {
    width: '100%',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 4,
  },
  reasonLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonText: { fontSize: 14, lineHeight: 20 },
});
