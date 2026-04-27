import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useVerificationGate } from '@/hooks/useVerificationGate';
import { safeGoBack } from '@/utils/navigation';
import { captureBreadcrumb, captureException } from '@/utils/sentry';

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ delivery?: string; devCode?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const { pendingVerificationEmail, checkAuth, user, signOut, markOnboardingCompleteLocally: _markOnboardingCompleteLocally } = useAuth();
  const [screenInfo, setScreenInfo] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If a user somehow lands here with email_verified already true (stale
  // route, manual deep link, backgrounded mid-flow), don't make them stare at
  // a dead verification screen — get them into the app immediately. The
  // AuthProvider routing effect will also catch this, but handling it here
  // eliminates a visible flash on cold-start.
  useEffect(() => {
    if (user?.email_verified === true && !isVerified) {
      void checkAuth();
    }
  }, [user?.email_verified, checkAuth, isVerified]);

  // Track mounted state so the deferred router.replace below can no-op
  // if the user navigated away during the 2-second delay (e.g., back-
  // gestured to /sign-in manually). Cleanup also clears the timeout so
  // it doesn't fire orphaned.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const gate = useVerificationGate({
    requestCode: () => User.requestVerification(),
    confirmCode: (code: string) => User.verifyEmail(code),
    autoFinishOnVerified: false,
    resendCooldownSeconds: 60,
    getRequestSuccessState: (res: any) => {
      if (res?.verification_email_sent === false) {
        const deliveryError = String(res?.verification_email_error || 'EMAIL_DELIVERY_FAILED');
        return {
          error:
            deliveryError === 'EMAIL_DELIVERY_TIMEOUT'
              ? 'We created a new verification code, but email delivery timed out. Try again shortly or contact support if this keeps happening.'
              : 'We created a new verification code, but the verification email could not be sent. Please try again later or contact support.',
          cooldownSeconds: 60,
        };
      }
      return {
        info: 'Verification code sent! Please check your email (and spam folder).',
        cooldownSeconds: 60,
      };
    },
    getRequestErrorMessage: (e: any) => {
      const status = e?.status;
      if (status === 429) {
        return 'Please wait a moment and try again.';
      }
      if (status === 401) {
        return 'Please sign in again to request a verification code.';
      }
      return e?.message || e?.data?.error || 'Resend failed';
    },
    getConfirmErrorMessage: (e: any) => {
      let errorMsg = e?.message || e?.data?.error || 'Verification failed';
      const status = e?.status;

      if (status === 429) {
        errorMsg = 'Too many attempts. Please wait a moment and try again.';
      } else if (status === 400) {
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
      return errorMsg;
    },
    onRequestSuccess: (res: any) => {
      captureBreadcrumb('Verification resend requested', 'auth', {
        context: 'verify-email-resend-success',
        sendgrid_ready: res?.dev_verification_code ? 'dev-mode' : 'production',
      });
    },
    onRequestError: (e: any) => {
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'verify-email-resend' },
        extra: { error_code: e?.data?.error },
      });
    },
    onConfirmError: (e: any) => {
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'verify-email-verify' },
        extra: { code_length: String(gate.code).length },
      });
    },
    onVerified: async () => {
      const _email = pendingVerificationEmail || user?.email;
      captureBreadcrumb('Email verified', 'auth', {
        context: 'verify-email-success',
        has_email: _email ? 'true' : 'false',
      });
      setScreenInfo('Email verified successfully!');
      setScreenError(null);
      setIsVerified(true);
      try {
        await checkAuth();
      } catch (userError) {
        captureException(
          typeof userError === 'string' ? new Error(userError) : (userError as Error),
          { tags: { context: 'verify-email-refresh' } }
        );
        setScreenError('Verification successful but failed to load profile. Please sign in again.');
        redirectTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          router.replace('/sign-in');
        }, 2000);
      }
    },
  });

  useEffect(() => {
    const deliveryStatus = typeof params.delivery === 'string' ? params.delivery : '';
    if (!deliveryStatus) return;

    if (deliveryStatus === 'EMAIL_DELIVERY_TIMEOUT') {
      setScreenError(
        'Your account was created, but the first verification email is delayed. Check spam, then tap Resend Code if nothing arrives.'
      );
      return;
    }

    setScreenError(
      'Your account was created, but the first verification email may not have been delivered. Tap Resend Code to send a fresh code.'
    );
  }, [params.delivery]);

  useEffect(() => {
    if (__DEV__ && typeof params.devCode === 'string') {
      gate.setCode(String(params.devCode).slice(0, 6));
    }
  }, [gate.setCode, params.devCode]);

  const onVerify = async () => {
    setScreenError(null);
    setScreenInfo(null);
    await gate.verify();
  };

  const onResend = async () => {
    setScreenError(null);
    setScreenInfo(null);
    await gate.resend();
  };

  const onContinue = async () => {
    await checkAuth();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Verify Your Account',
          headerShown: false,
        }}
      />

      {/* Header Icon */}
      <View style={styles.iconContainer}>
        <MaterialIcons name="mail-outline" size={64} color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} />
      </View>

      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Check Your Email</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
        We sent a 6-digit verification code to {pendingVerificationEmail || user?.email || 'your email address'}.
        Enter the code below to complete your registration.
      </Text>

      {screenError || gate.error ? <Text style={styles.error}>{screenError || gate.error}</Text> : null}
      {screenInfo || gate.info ? <Text style={styles.info}>{screenInfo || gate.info}</Text> : null}

      <View style={styles.codeSection}>
        <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Verification Code</Text>
        <Input
          placeholder="Enter 6-digit code"
          value={gate.code}
          onChangeText={(t: string) => {
            const cleaned = t.replace(/[^0-9]/g, '');
            gate.setCode(cleaned);
            if (cleaned.length === 6) {
              // v1.0.2 audit fix: auto-submit at 6 digits so users aren't stuck hunting for a button.
              setTimeout(() => {
                Keyboard.dismiss();
                if (!gate.loading && !isVerified) {
                  void onVerify();
                }
              }, 150);
            }
          }}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (gate.code.trim().length >= 6 && !gate.loading && !isVerified) void onVerify();
          }}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.codeInput}
        />
      </View>

      {isVerified ? (
        <Button onPress={onContinue} style={styles.verifyButton}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Continue to App</Text>
        </Button>
      ) : (
        <Button
          onPress={onVerify}
          disabled={gate.loading || gate.code.trim().length < 6}
          style={styles.verifyButton}
        >
          {gate.loading ? <ActivityIndicator color="#fff" /> : 'Verify Email'}
        </Button>
      )}

      {!isVerified && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: Colors[colorScheme].mutedText }]}>Didn't receive the code?</Text>
          <Pressable onPress={onResend} disabled={gate.loading || gate.resendCooldown > 0}>
            <Text style={[styles.linkText, { color: Colors[colorScheme].tint }, (gate.loading || gate.resendCooldown > 0) && styles.linkTextDisabled]}>
              {gate.resendCooldown > 0 ? `Resend in ${gate.resendCooldown}s` : 'Resend Code'}
            </Text>
          </Pressable>
          {/* Escape hatch: a user who can't verify (wrong email typed at signup,
              lost access to inbox, etc.) must have a path back to sign-in.
              Without this they're stuck — AuthProvider bounces any navigation
              back to /verify as long as the account exists and is unverified. */}
          <Pressable
            onPress={() => { void signOut(); }}
            disabled={gate.loading}
            style={{ marginTop: 16 }}
            accessibilityRole="button"
            accessibilityLabel="Sign out and use a different account"
          >
            <Text style={[styles.linkText, { color: Colors[colorScheme].mutedText, fontSize: 13 }]}>
              Wrong account? Sign out
            </Text>
          </Pressable>
        </View>
      )}


      {isVerified && (
        <Text style={[styles.autoRedirectText, { color: Colors[colorScheme].mutedText }]}>
          Continuing to the app…
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
  error: { color: '#DC2626', marginBottom: 12, textAlign: 'center', fontSize: 14 },
  info: { color: '#059669', marginBottom: 12, textAlign: 'center', fontSize: 14 },
  autoRedirectText: { fontSize: 14, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});
