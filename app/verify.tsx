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
import { extractApiError } from '@/utils/apiErrors';
import { captureBreadcrumb, captureException } from '@/utils/sentry';

type VerificationRequestResponse = {
  verification_email_sent?: boolean;
  verification_email_error?: string | null;
  dev_verification_code?: string | null;
};

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(typeof value === 'string' ? value : 'Unknown error');

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    delivery?: string;
    devCode?: string;
    token?: string;
    email?: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const { pendingVerificationEmail, checkAuth, user, signOut, markOnboardingCompleteLocally: _markOnboardingCompleteLocally } = useAuth();
  const [screenInfo, setScreenInfo] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoVerifyAttemptRef = useRef<string | null>(null);
  const deepLinkToken =
    typeof params.token === 'string' ? params.token.replace(/[^0-9]/g, '').slice(0, 6) : '';
  const deepLinkEmail =
    typeof params.email === 'string' && params.email.trim().length > 0
      ? params.email.trim().toLowerCase()
      : '';
  const activeEmail =
    (pendingVerificationEmail || user?.email || '').trim().toLowerCase();
  const displayEmail =
    pendingVerificationEmail || user?.email || deepLinkEmail || 'your email address';
  const signedIntoMatchingAccount =
    !!activeEmail && (!deepLinkEmail || activeEmail === deepLinkEmail);
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
    getRequestSuccessState: (res: VerificationRequestResponse) => {
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
    getRequestErrorMessage: (e: unknown) => {
      const { code, message, status } = extractApiError(e, 'Resend failed');
      if (code === 'VERIFY_REQUEST_COOLDOWN') {
        return 'Please wait a moment before requesting another code.';
      }
      if (code === 'VERIFY_REQUEST_RATE_LIMITED') {
        return 'Too many verification requests. Please try again later.';
      }
      if (status === 429) {
        return 'Please wait a moment and try again.';
      }
      if (status === 401) {
        return 'Please sign in again to request a verification code.';
      }
      return message;
    },
    getConfirmErrorMessage: (e: unknown) => {
      const { code, message, status } = extractApiError(e, 'Verification failed');

      if (code === 'VERIFY_CODE_EXPIRED') {
        return 'Verification code has expired. Please request a new code.';
      }
      if (code === 'VERIFY_CODE_INVALID') {
        return 'Invalid verification code. Please check the code and try again.';
      }
      if (code === 'VERIFY_NO_CODE') {
        return 'No verification code found. Please request a new code.';
      }
      if (code === 'VERIFY_NOT_FOUND') {
        return 'Account not found. Please contact support.';
      }
      if (status === 429) {
        return 'Too many attempts. Please wait a moment and try again.';
      }
      if (status === 401) {
        return 'Please sign in again to verify your email.';
      }
      if (status === 404) {
        return 'Account not found. Please contact support.';
      }
      return message;
    },
    onRequestSuccess: (res: VerificationRequestResponse) => {
      captureBreadcrumb('Verification resend requested', 'auth', {
        context: 'verify-email-resend-success',
        sendgrid_ready: res?.dev_verification_code ? 'dev-mode' : 'production',
      });
    },
    onRequestError: (e: unknown) => {
      const apiError = extractApiError(e, 'Resend failed');
      captureException(toError(e), {
        tags: { context: 'verify-email-resend' },
        extra: { error_code: apiError.code, error_message: apiError.message },
      });
    },
    onConfirmError: (e: unknown) => {
      captureException(toError(e), {
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
        captureException(toError(userError), { tags: { context: 'verify-email-refresh' } });
        setScreenError('Verification successful but failed to load profile. Please sign in again.');
        redirectTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          router.replace('/sign-in');
        }, 2000);
      }
    },
  });
  const { code, error, info, loading, resend, resendCooldown, setCode, verify } = gate;

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
      setCode(String(params.devCode).slice(0, 6));
    }
  }, [params.devCode, setCode]);

  useEffect(() => {
    if (!deepLinkToken) return;
    setCode(deepLinkToken);

    if (!activeEmail) {
      setScreenInfo(
        deepLinkEmail
          ? `Sign in as ${deepLinkEmail} to finish verifying this email address.`
          : 'Sign in to finish verifying your email address.'
      );
      return;
    }

    if (!signedIntoMatchingAccount) {
      setScreenError(
        `This verification link is for ${deepLinkEmail}, but you're signed in as ${activeEmail}. Sign out and use the matching account.`
      );
      return;
    }

    setScreenInfo('Verification link received. Finishing confirmation...');
  }, [activeEmail, deepLinkEmail, deepLinkToken, setCode, signedIntoMatchingAccount]);

  useEffect(() => {
    if (!deepLinkToken) return;
    if (!signedIntoMatchingAccount) return;
    if (loading || isVerified) return;
    if (code !== deepLinkToken) return;
    if (autoVerifyAttemptRef.current === deepLinkToken) return;

    autoVerifyAttemptRef.current = deepLinkToken;
    setScreenError(null);
    setScreenInfo(null);
    void verify();
  }, [code, deepLinkToken, isVerified, loading, signedIntoMatchingAccount, verify]);

  const onVerify = async () => {
    setScreenError(null);
    setScreenInfo(null);
    await verify();
  };

  const onResend = async () => {
    setScreenError(null);
    setScreenInfo(null);
    await resend();
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
        We sent a 6-digit verification code to {displayEmail}.
        Enter the code below to complete your registration.
      </Text>

      {screenError || error ? <Text style={styles.error}>{screenError || error}</Text> : null}
      {screenInfo || info ? <Text style={styles.info}>{screenInfo || info}</Text> : null}

      <View style={styles.codeSection}>
        <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Verification Code</Text>
        <Input
          placeholder="Enter 6-digit code"
          value={code}
          onChangeText={(t: string) => {
            const cleaned = t.replace(/[^0-9]/g, '');
            setCode(cleaned);
            if (cleaned.length === 6) {
              // v1.0.2 audit fix: auto-submit at 6 digits so users aren't stuck hunting for a button.
              setTimeout(() => {
                Keyboard.dismiss();
                if (!loading && !isVerified) {
                  void onVerify();
                }
              }, 150);
            }
          }}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (code.trim().length >= 6 && !loading && !isVerified) void onVerify();
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
            disabled={loading || code.trim().length < 6}
            style={styles.verifyButton}
          >
          {loading ? <ActivityIndicator color="#fff" /> : 'Verify Email'}
        </Button>
      )}

      {!isVerified && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: Colors[colorScheme].mutedText }]}>Didn't receive the code?</Text>
          <Pressable onPress={onResend} disabled={loading || resendCooldown > 0}>
            <Text style={[styles.linkText, { color: Colors[colorScheme].tint }, (loading || resendCooldown > 0) && styles.linkTextDisabled]}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </Text>
          </Pressable>
          {/* Escape hatch: a user who can't verify (wrong email typed at signup,
              lost access to inbox, etc.) must have a path back to sign-in.
              Without this they're stuck — AuthProvider bounces any navigation
              back to /verify as long as the account exists and is unverified. */}
          <Pressable
            onPress={() => { void signOut(); }}
            disabled={loading}
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
