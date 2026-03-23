import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View, useColorScheme, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
// @ts-ignore
import { User } from '@/api/entities';
import { httpGet } from '@/api/http';
import { captureException } from '@/utils/sentry';

export default function LeaguePendingApproval() {
  const router = useRouter();
  const { signOut, markOnboardingCompleteLocally, checkAuth } = useAuth();
  const { state: ob } = useOnboarding();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ leagueName?: string; orgId?: string }>();
  const leagueName = params.leagueName || 'your league';
  const orgId = String(params.orgId || ob.organization_id || '').trim();
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [checking, setChecking] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll organization status every 30 seconds
  const checkApproval = useCallback(async () => {
    if (!orgId) {
      setCompletionError('Organization setup is incomplete. Go back to league setup and select or create your organization.');
      return;
    }
    try {
      setChecking(true);
      setCompletionError(null);
      const org: any = await httpGet(`/organizations/${orgId}`);
      if (org?.status === 'rejected' || org?.admin_approved === false && org?.status === 'rejected') {
        setRejected(true);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        return;
      }
      if (org?.admin_approved === true) {
        setApproved(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        // Complete onboarding on server, then go to main app.
        // If completion fails, stay here and surface a retry action.
        let completed = false;
        try {
          // Use server data (me) as primary source, fall back to local state (ob)
          const me: any = await User.me().catch(() => null);
          const mePrefs = me?.preferences || {};
          await User.completeOnboarding({
            role: 'coach',
            username: me?.username || ob.username || mePrefs.username,
            dob: me?.dob || ob.dob || mePrefs.dob,
            zip_code: me?.zip_code || ob.zip_code || ob.zip || mePrefs.zip_code,
            affiliation: mePrefs.affiliation || ob.affiliation,
            organization_id: orgId || mePrefs.organization_id || ob.organization_id,
            organization_name: leagueName || mePrefs.organization_name || ob.organization_name,
            plan: mePrefs.plan || (ob as any).plan || 'rookie',
            team_id: mePrefs.team_id || (ob as any).team_id,
            team_name: mePrefs.team_name || (ob as any).team_name,
          });
          await markOnboardingCompleteLocally();
          await checkAuth();
          completed = true;
        } catch (err) {
          if (__DEV__) console.warn('[league-pending-approval] Failed to complete onboarding:', err);
          captureException(err instanceof Error ? err : new Error(String(err)), {
            tags: { component: 'LeaguePendingApproval', action: 'completeOnboarding' },
          });
        }
        if (!completed) {
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
        if (!completed) {
          setCompletionError('VarsityHub has approved your organization, but account setup failed. Tap retry below.');
          return;
        }
        setTimeout(() => {
          router.replace('/(tabs)' as any);
        }, 2000);
      }
    } catch {
      // ignore polling errors
    } finally {
      setChecking(false);
    }
  }, [leagueName, markOnboardingCompleteLocally, ob.affiliation, ob.dob, ob.organization_id, ob.organization_name, ob.username, ob.zip, ob.zip_code, orgId, router]);

  useEffect(() => {
    if (!orgId) return;
    void checkApproval();
    intervalRef.current = setInterval(() => void checkApproval(), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
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
      if (__DEV__) console.warn('[league-pending-approval] Failed to proceed as fan:', err);
      captureException(err instanceof Error ? err : new Error(String(err)), {
        tags: { component: 'LeaguePendingApproval', action: 'proceedAsFan' },
      });
      Alert.alert('Setup Issue', 'Could not complete setup. Please check your connection and try again. If this persists, try signing out and back in.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1120' : '#F8FAFC' }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.content}>
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
          <Image source={{ uri: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765997882/365220-200_mvbdz7.png' }} style={{ width: 56, height: 56 }} contentFit="contain" />
        </View>

        {/* Heading */}
        <Text style={[styles.heading, { color: isDark ? '#F9FAFB' : '#111827' }]}>
          {rejected ? 'League Not Approved' : approved ? 'Approved by VarsityHub!' : 'Submitted to VarsityHub for Review'}
        </Text>

        {/* Subheading */}
        <Text style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          {rejected
            ? `"${leagueName}" was not approved. You can try creating a new league or continue as a fan. Contact support@varsityhub.app for questions.`
            : approved
              ? `"${leagueName}" is now live on VarsityHub! Let's finish setting up...`
              : `VarsityHub is reviewing "${leagueName}". This usually takes less than 24 hours. You'll receive an email when your league is approved and ready.`
          }
        </Text>

        {!orgId ? (
          <>
            <Text style={[styles.supportText, { color: '#EF4444', marginTop: 0, marginBottom: 12 }]}>
              Organization ID is missing for this account. Please return to league setup.
            </Text>
            <Pressable
              style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#D1D5DB' }]}
              onPress={() => router.replace('/onboarding/step-3-league' as any)}
            >
              <Text style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Back to Organization Setup</Text>
            </Pressable>
          </>
        ) : null}

        {!approved && orgId && (
          <>
            {/* Info card */}
            <View style={[styles.infoCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? '#374151' : '#D1D5DB' }]}>
              <View style={styles.infoRow}>
                <MaterialIcons name="business" size={18} color={isDark ? '#60A5FA' : '#2563EB'} />
                <Text style={[styles.infoLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Organization:</Text>
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
            <ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 24 }} />
            {completionError ? (
              <>
                <Text style={[styles.supportText, { color: '#EF4444', marginTop: 16, marginBottom: 8 }]}>
                  {completionError}
                </Text>
                <Pressable style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#D1D5DB' }]} onPress={() => { void checkApproval(); }}>
                  <Text style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Retry Setup</Text>
                </Pressable>
              </>
            ) : null}
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
});
