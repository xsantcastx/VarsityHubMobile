import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useVerificationGate } from '@/hooks/useVerificationGate';
import { captureBreadcrumb, captureException } from '@/utils/sentry';
import { VerificationCodeScreenBase } from '@/components/VerificationCodeScreenBase';

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ delivery?: string; devCode?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const { pendingVerificationEmail, checkAuth, user, signOut } = useAuth();
  const [screenInfo, setScreenInfo] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (user?.email_verified === true && !isVerified) {
      void checkAuth();
    }
  }, [user?.email_verified, checkAuth, isVerified]);

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
      const email = pendingVerificationEmail || user?.email;
      captureBreadcrumb('Email verified', 'auth', {
        context: 'verify-email-success',
        has_email: email ? 'true' : 'false',
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
  const setGateCode = gate.setCode;

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
      setGateCode(String(params.devCode).slice(0, 6));
    }
  }, [params.devCode, setGateCode]);

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

  const wrongAccountLabel = 'Wrong account? Sign out';
  const subtitleText = `We sent a 6-digit verification code to ${
    pendingVerificationEmail || user?.email || 'your email address'
  }. Enter the code below to complete your registration.`;

  return (
    <VerificationCodeScreenBase
      subtitle={subtitleText}
      gate={gate}
      screenError={screenError}
      screenInfo={screenInfo}
      isVerified={isVerified}
      onVerify={onVerify}
      onResend={onResend}
      onContinue={onContinue}
      devCode={typeof params.devCode === 'string' ? params.devCode : null}
      verifiedHintText="Continuing to the app…"
      postFooterContent={
        <Pressable
          onPress={() => {
            void signOut();
          }}
          disabled={gate.loading}
          style={{ marginTop: 16 }}
          accessibilityRole="button"
          accessibilityLabel={wrongAccountLabel}
        >
          <Text style={{ color: Colors[colorScheme].mutedText, fontSize: 13, fontWeight: '700' }}>
            {wrongAccountLabel}
          </Text>
        </Pressable>
      }
    />
  );
}
