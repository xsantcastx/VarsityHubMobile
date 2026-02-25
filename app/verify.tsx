import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { captureException } from '@/utils/sentry';

export default function VerifyScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const params = useLocalSearchParams<{ devCode?: string }>();
  const { pendingVerificationEmail, checkAuth, user, markOnboardingCompleteLocally } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [devCodeLoading, setDevCodeLoading] = useState(false);

  // Only allow dev verification in development mode - NEVER in production
  const devVerificationEnabled = useMemo(() => {
    return __DEV__;
  }, []);
  const configuredDevCode = process.env.EXPO_PUBLIC_DEV_VERIFICATION_CODE;

  // Load dev code from params if available
  useEffect(() => {
    if (params.devCode) {
      setDevCode(params.devCode);
      setCode(params.devCode);
    }
  }, [params.devCode]);

  const onVerify = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null); setInfo(null);

    const startTime = Date.now();
    const email = pendingVerificationEmail || user?.email;

    try {
      await User.verifyEmail(code.trim());
      const verifyDuration = Date.now() - startTime;

      captureException(new Error(`[TELEMETRY] Email verified in ${verifyDuration}ms`), {
        tags: { context: 'verify-email-success', duration_ms: String(verifyDuration) },
        extra: { email },
      });

      setInfo('Email verified successfully!');
      setCode('');
      setIsVerified(true);

      // After successful verification, refresh auth state and navigate
      try {
        await checkAuth();

        let destination: any = '/(tabs)/feed';
        try {
          const refreshed: any = await User.me();
          const resolvedRole = refreshed?.preferences?.role || refreshed?.role || (user as any)?.preferences?.role;
          const isFan = !resolvedRole || resolvedRole === 'fan';
          const onboardingCompleted = refreshed?.preferences?.onboarding_completed;

          if (onboardingCompleted) {
            // User already completed onboarding, go to feed
            destination = '/(tabs)/feed';
          } else if (!isFan) {
            // Coach/org user who hasn't completed onboarding
            // Check if they've already selected a role and have progress
            const hasRole = !!resolvedRole && resolvedRole !== 'fan';
            const hasUsername = !!refreshed?.username;

            if (hasRole && hasUsername) {
              // They have role and username, resume from step 3 (plan selection)
              destination = '/onboarding/step-3-plan';
            } else if (hasRole) {
              // They have role but not username, resume from step 2
              destination = '/onboarding/step-2-basic';
            } else {
              // Start fresh
              destination = '/onboarding/step-1-role';
            }
          } else {
            // Fan user - mark onboarding as complete
            await markOnboardingCompleteLocally();
          }
        } catch (profileError) {
          captureException(
            typeof profileError === 'string' ? new Error(profileError) : (profileError as Error),
            { tags: { context: 'verify-email-profile' }, extra: { email } }
          );
        }

        setTimeout(() => {
          router.replace(destination);
        }, 1200);
      } catch (userError) {
        captureException(
          typeof userError === 'string' ? new Error(userError) : (userError as Error),
          { tags: { context: 'verify-email-refresh' }, extra: { email } }
        );
        setError('Verification successful but failed to load profile. Please sign in again.');
        setTimeout(() => {
          router.replace('/sign-in');
        }, 2000);
      }
    } catch (e: any) {
      const errorDuration = Date.now() - startTime;
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'verify-email-verify', duration_ms: String(errorDuration) },
        extra: { email, code_length: String(code).length },
      });
      
      // Provide more helpful error messages
      let errorMsg = e?.message || e?.data?.error || 'Verification failed';
      const status = e?.status;
      
      if (status === 400) {
        if (errorMsg.includes('expired')) {
          errorMsg = 'Verification code has expired. Please request a new code.';
        } else if (errorMsg.includes('Invalid code')) {
          errorMsg = 'Invalid verification code. Please check the code and try again.';
        } else if (errorMsg.includes('No verification in progress')) {
          errorMsg = 'No verification code found. Please request a new code.';
        }
      } else if (status === 401) {
        errorMsg = 'Please sign in again to verify your email.';
      } else if (status === 404) {
        errorMsg = 'Account not found. Please contact support.';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setLoading(true); setError(null); setInfo(null);

    const startTime = Date.now();
    const email = pendingVerificationEmail || user?.email;

    try {
      const res: any = await User.requestVerification();
      const resendDuration = Date.now() - startTime;

      captureException(new Error(`[TELEMETRY] Resend requested in ${resendDuration}ms`), {
        tags: { context: 'verify-email-resend-success', duration_ms: String(resendDuration) },
        extra: { email, sendgrid_ready: res?.dev_verification_code ? 'dev-mode' : 'production' },
      });

      if (res?.dev_verification_code) {
        setDevCode(res.dev_verification_code);
        setInfo(`Code sent! Dev code: ${res.dev_verification_code}`);
      } else {
        setInfo('Verification code sent! Please check your email (and spam folder).');
      }
    } catch (e: any) {
      const resendDuration = Date.now() - startTime;
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'verify-email-resend', duration_ms: String(resendDuration) },
        extra: { email, error_code: e?.data?.error },
      });
      
      let errorMsg = e?.message || e?.data?.error || 'Resend failed';
      const status = e?.status;
      
      // Provide helpful error messages
      if (status === 429) {
        if (errorMsg.includes('wait')) {
          errorMsg = 'Please wait 30 seconds before requesting another code.';
        } else {
          errorMsg = 'Too many requests. Please try again in an hour.';
        }
      } else if (status === 401) {
        errorMsg = 'Please sign in again to request a verification code.';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleUseDevCode = async () => {
    if (!devVerificationEnabled) return;

    if (devCode) {
      setCode(devCode);
      setInfo(`Using dev code ${devCode}`);
      // Auto-verify with dev code
      setTimeout(() => onVerify(), 500);
      return;
    }

    if (configuredDevCode) {
      setDevCode(configuredDevCode);
      setCode(configuredDevCode);
      setInfo(`Using configured dev code ${configuredDevCode}`);
      // Auto-verify with dev code
      setTimeout(() => onVerify(), 500);
      return;
    }

    setDevCodeLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res: any = await User.requestVerification();
      if (res?.dev_verification_code) {
        setDevCode(res.dev_verification_code);
        setCode(res.dev_verification_code);
        setInfo(`Using dev code ${res.dev_verification_code}`);
        // Auto-verify with fetched dev code
        setTimeout(() => onVerify(), 500);
      } else {
        setInfo('Dev code unavailable. Check backend configuration.');
      }
    } catch (e: any) {
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'verify-email-dev-code' },
      });
      const errorMsg = e?.message || e?.data?.error || 'Failed to fetch dev code';
      setError(errorMsg);
    } finally {
      setDevCodeLoading(false);
    }
  };

  const onContinue = async () => {
    // Navigate to onboarding after email verification
    router.replace('/onboarding/step-1-role');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Verify Your Account',
          headerShown: false,
        }}
      />

      {/* Back Button */}
      <Pressable
        onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)}
        style={styles.backButton}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
      </Pressable>

      {/* Header Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name="mail-outline" size={64} color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} />
      </View>

      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Check Your Email</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
        We sent a 6-digit verification code to {pendingVerificationEmail || user?.email || 'your email address'}.
        Enter the code below to complete your registration.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      {/* Dev Code Display */}
      {devCode ? (
        <View style={styles.devCodeContainer}>
          <Ionicons name="bug-outline" size={16} color="#059669" />
          <Text style={styles.devCodeText}>Dev Code: {devCode}</Text>
        </View>
      ) : null}

      <View style={styles.codeSection}>
        <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Verification Code</Text>
        <Input
          placeholder="123456"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.codeInput}
        />
      </View>

      {devVerificationEnabled && (
        <Pressable
          style={[styles.devButton, devCodeLoading && styles.devButtonDisabled]}
          onPress={handleUseDevCode}
          disabled={devCodeLoading}
        >
          <Ionicons name="bug-outline" size={16} color="#065F46" />
          <Text style={styles.devButtonText}>
            {devCodeLoading ? 'Fetching dev code...' : 'Use dev code (testing only)'}
          </Text>
        </Pressable>
      )}

      {isVerified ? (
        <Button onPress={onContinue} style={styles.verifyButton}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Continue to App</Text>
        </Button>
      ) : (
        <Button
          onPress={onVerify}
          disabled={loading || code.trim().length < 4}
          style={styles.verifyButton}
        >
          {loading ? <ActivityIndicator color="#fff" /> : 'Verify Email'}
        </Button>
      )}

      {!isVerified && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: Colors[colorScheme].mutedText }]}>Didn't receive the code?</Text>
          <Pressable onPress={onResend} disabled={loading}>
            <Text style={[styles.linkText, { color: Colors[colorScheme].tint }, loading && styles.linkTextDisabled]}>Resend Code</Text>
          </Pressable>
        </View>
      )}

      {!isVerified && (
        <Pressable style={styles.skipButton} onPress={() => void router.replace('/onboarding/step-1-role')}>
          <Text style={[styles.skipText, { color: Colors[colorScheme].mutedText }]}>Skip for now</Text>
        </Pressable>
      )}

      {isVerified && (
        <Text style={[styles.autoRedirectText, { color: Colors[colorScheme].mutedText }]}>
          Automatically continuing in a few seconds...
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  iconContainer: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  codeSection: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  codeInput: { fontSize: 24, textAlign: 'center', letterSpacing: 8 },
  verifyButton: { marginBottom: 16 },
  footer: { alignItems: 'center', marginTop: 8, gap: 8 },
  footerText: { fontSize: 14 },
  linkText: { fontWeight: '700', fontSize: 14 },
  linkTextDisabled: { opacity: 0.5 },
  skipButton: { marginTop: 20, alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 14 },
  error: { color: '#DC2626', marginBottom: 12, textAlign: 'center', fontSize: 14 },
  info: { color: '#059669', marginBottom: 12, textAlign: 'center', fontSize: 14 },
  devCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16
  },
  devCodeText: { color: '#059669', fontSize: 14, fontWeight: '600' },
  autoRedirectText: { fontSize: 14, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 16,
  },
  devButtonDisabled: {
    opacity: 0.6,
  },
  devButtonText: {
    color: '#065F46',
    fontWeight: '600',
    fontSize: 14,
  },
});
