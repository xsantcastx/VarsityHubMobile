import { OnboardingBackHeader } from '@/components/onboarding/OnboardingBackHeader';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/input';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { useAuth } from '@/context/AuthProvider';
import { Type } from '@/ui/tokens';
import { useVerifyEmail } from '@/hooks/useVerifyEmail';

export default function OnboardingFinish() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user: me, loading: authLoading, checkAuth, markOnboardingCompleteLocally } = useAuth();
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorFrom, setErrorFrom] = useState<'send' | 'verify' | null>(null);
  const timerRef = useRef<any>(null);
  const { sendCode: sendCodeApi } = useVerifyEmail();

  useEffect(() => {
    if (cooldown <= 0) return; 
    timerRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [cooldown]);

  const sendCode = async () => {
    setSending(true);
    setError(null);
    setErrorFrom(null);
    try {
      await sendCodeApi();
      setCooldown(30);
    } catch (e: any) {
      setError(e?.message || 'Failed to send code. Please try again.');
      setErrorFrom('send');
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (!code.trim()) {
      setError('Please enter the 6-digit code');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const { User } = await import('@/api/entities');
      await User.verifyEmail(code.trim());
      await checkAuth();

      // Mark onboarding as complete on server before navigating
      try {
        await User.completeOnboarding({});
        await checkAuth();
      } catch (completeErr) {
        console.error('[Onboarding][Finish] Failed to mark onboarding complete:', completeErr);
      }

      try {
        await markOnboardingCompleteLocally();
      } catch (err) {
        console.warn('[Onboarding][Finish] Failed to mark locally:', err);
      }

      router.replace('/(tabs)/feed');
    } catch (e: any) {
      setError(e?.message || 'Invalid code. Check the code and try again.');
      setErrorFrom('verify');
    } finally {
      setVerifying(false);
    }
  };

  const skip = async () => {
    // Mark onboarding as complete even when skipping email verification
    try {
      const { User } = await import('@/api/entities');
      await User.completeOnboarding({});
      await checkAuth();
      // Onboarding marked complete during skip
    } catch (completeErr) {
      console.error('[Onboarding][Finish] Failed to mark onboarding complete:', completeErr);
    }
    
    try {
      await markOnboardingCompleteLocally();
    } catch (error) {
      console.warn('[Onboarding][Finish] Failed to mark locally:', error);
    }
    
    router.replace('/(tabs)/feed');
  };

  const verified = !!me?.email_verified;

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Finish' }} />
        <OnboardingBackHeader title="Email Verification" subtitle="Enter the 6-digit code to finish onboarding" />
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
          <Text style={[styles.stateText, { color: theme.mutedText }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Finish' }} />
      <OnboardingBackHeader
        title="Email Verification"
        subtitle="Enter the 6-digit code to finish onboarding"
      />
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={[styles.title, { color: theme.text }]}>You're all set! 🎉</Text>
        {verified ? (
          <>
            <Text style={[styles.muted, { color: theme.mutedText }]}>Your email is verified. Enjoy Varsity Hub!</Text>
            <PrimaryButton label="Go to Feed" onPress={() => skip()} />
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Verify your email to unlock messaging & RSVPs</Text>
            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
                <Text style={styles.errorBannerText}>{error}</Text>
                <Pressable
                  style={[styles.retryButton, { backgroundColor: theme.tint }]}
                  onPress={() => {
                    setError(null);
                    setErrorFrom(null);
                    if (errorFrom === 'send') void sendCode();
                  }}
                >
                  <Text style={styles.retryButtonText}>{errorFrom === 'send' ? 'Try Again' : 'Dismiss'}</Text>
                </Pressable>
              </View>
            ) : null}
            <Input placeholder="Enter 6-digit code" value={code} onChangeText={(t) => { setCode(t); setError(null); setErrorFrom(null); }} keyboardType="number-pad" style={{ marginBottom: 8 }} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <PrimaryButton label={cooldown>0 ? `Resend in ${cooldown}s` : 'Send Code'} onPress={sendCode} disabled={sending || cooldown>0} loading={sending} />
              <PrimaryButton label={verifying ? 'Verifying…' : 'Verify'} onPress={verify} disabled={verifying} loading={verifying} />
            </View>
            <PrimaryButton label="Skip for now" onPress={skip} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { ...(Type.h1 as any) },
  muted: { fontSize: 14, lineHeight: 20 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  stateText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});