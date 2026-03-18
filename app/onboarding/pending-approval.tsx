import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View, useColorScheme, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';

export default function PendingApproval() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { signOut, markOnboardingCompleteLocally, checkAuth } = useAuth();
  const { state: ob } = useOnboarding();
  const params = useLocalSearchParams<{ leagueName?: string; ownerName?: string }>();
  const leagueName = params.leagueName || 'the league';
  const ownerName = params.ownerName || 'the league admin';
  const [approved, setApproved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll /me every 30 seconds to check approval_status
  const checkApproval = useCallback(async () => {
    try {
      setChecking(true);
      setCompletionError(null);
      const me: any = await User.me();
      if (me?.approval_status === 'APPROVED') {
        setApproved(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        // Complete onboarding on server, then go to main app.
        // If completion fails, stay here and show a retry state instead of redirect loops.
        let completed = false;
        try {
          // Use server data (me) as primary source, fall back to local state (ob)
          await User.completeOnboarding({
            role: 'coach',
            username: me?.username || ob.username,
            dob: me?.dob || ob.dob,
            zip_code: me?.zip_code || ob.zip_code || ob.zip,
            affiliation: me?.preferences?.affiliation || ob.affiliation,
            organization_id: me?.preferences?.organization_id || ob.organization_id,
            organization_name: me?.preferences?.organization_name || ob.organization_name,
          });
          await markOnboardingCompleteLocally();
          completed = true;
        } catch (err) {
          if (__DEV__) console.warn('[pending-approval] Failed to complete onboarding:', err);
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
          setCompletionError('Approval is complete, but final account setup failed. Tap retry below.');
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
  }, [markOnboardingCompleteLocally, ob.affiliation, ob.dob, ob.organization_id, ob.organization_name, ob.username, ob.zip, ob.zip_code, router]);

  useEffect(() => {
    // Initial check
    void checkApproval();
    // Poll every 30 seconds
    intervalRef.current = setInterval(() => void checkApproval(), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
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
          <Ionicons name="shield-checkmark" size={28} color="#1B3A6B" />
          <Text style={[styles.logoText, { color: isDark ? '#F9FAFB' : '#111827' }]}>VarsityHub</Text>
        </View>

        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(218,165,32,0.15)' : '#FEF9C3' }]}>
          {approved ? (
            <MaterialIcons name="check-circle" size={56} color="#16A34A" />
          ) : (
            <Ionicons name="hourglass-outline" size={56} color="#DAA520" />
          )}
        </View>

        {/* Heading */}
        <Text style={[styles.heading, { color: isDark ? '#F9FAFB' : '#111827' }]}>
          {approved ? 'You\'re Approved!' : 'Application Submitted'}
        </Text>

        {/* Subheading */}
        <Text style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          {approved
            ? `Welcome to ${leagueName}! Setting up your coach account...`
            : `Your request to join "${leagueName}" has been sent to ${ownerName}. You'll receive an email and notification when you're approved.`
          }
        </Text>

        {!approved && (
          <>
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
});
