import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { User } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { useVerificationGate } from '@/hooks/useVerificationGate';
import { safeGoBack } from '@/utils/navigation';
import { getFreshAuthSnapshot } from '@/utils/authState';
import { getPostAuthLandingRoute } from '@/utils/postAuthRouting';
import { VerificationCodeScreenBase } from '@/components/VerificationCodeScreenBase';

type ParamValue = string | string[] | undefined;

const toSingleValue = (value: ParamValue): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

function VerifyScreen() {
  const router = useRouter();
  const { checkAuth, user } = useAuth();
  const params = useLocalSearchParams<{ devCode?: ParamValue }>();

  const [screenInfo, setScreenInfo] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setScreenError(null);
    setScreenInfo(null);
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const gate = useVerificationGate({
    requestCode: () => User.requestVerification(),
    confirmCode: (code: string) => User.verifyEmail(code),
    autoFinishOnVerified: false,
    resendCooldownSeconds: 60,
    getRequestSuccessState: (res: any) => ({
      info: __DEV__ && res?.dev_verification_code ? `Code sent (dev: ${res.dev_verification_code})` : 'Code sent',
      cooldownSeconds: 60,
    }),
    getConfirmErrorMessage: (e: any) => e?.message || e?.data?.error || 'Verification failed',
    getRequestErrorMessage: (e: any) => e?.message || e?.data?.error || 'Resend failed',
    onVerified: async () => {
      const freshUser = await checkAuth().catch(() => null);
      setScreenInfo('Email verified successfully!');
      setScreenError(null);
      setIsVerified(true);

      try {
        const userInfo = freshUser ?? (await getFreshAuthSnapshot(checkAuth, user));
        const targetRoute = getPostAuthLandingRoute(userInfo);
        redirectTimerRef.current = setTimeout(() => {
          router.replace(targetRoute as any);
        }, 3000);
      } catch (meErr: any) {
        const status = meErr?.status ?? meErr?.response?.status ?? null;
        if (status === 401 || status === 403) {
          setScreenError('Your session expired. Please sign in again.');
          redirectTimerRef.current = setTimeout(() => router.replace('/sign-in'), 2000);
        } else {
          setScreenError('Could not load your profile. Tap Continue to retry.');
        }
      }
    },
  });
  const setGateCode = gate.setCode;

  useEffect(() => {
    const fromParams = toSingleValue(params.devCode);
    if (fromParams) {
      setDevCode(fromParams);
      setGateCode(fromParams);
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
    try {
      const userInfo = await getFreshAuthSnapshot(checkAuth, user);
      router.replace(getPostAuthLandingRoute(userInfo) as any);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status ?? null;
      if (status === 401 || status === 403) {
        setScreenError('Your session expired. Please sign in again.');
        router.replace('/sign-in');
      } else {
        setScreenError('Could not load your profile. Please try again.');
      }
    }
  };

  return (
    <VerificationCodeScreenBase
      subtitle="We sent a 6-digit verification code to your email address."
      gate={gate}
      screenError={screenError}
      screenInfo={screenInfo}
      isVerified={isVerified}
      onVerify={onVerify}
      onResend={onResend}
      onContinue={onContinue}
      useKeyboardAwareScroll
      showBackButton
      onBackPress={() => {
        safeGoBack(router);
      }}
      devCode={devCode}
      backLinkLabel="Go back"
      onBackLinkPress={() => {
        safeGoBack(router);
      }}
      verifiedHintText="Automatically continuing in a few seconds..."
    />
  );
}

export default VerifyScreen;
