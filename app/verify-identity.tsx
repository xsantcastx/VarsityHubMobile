import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Href } from 'expo-router';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useVerificationGate } from '@/hooks/useVerificationGate';
import { safeGoBack } from '@/utils/navigation';
import { getPostAuthLandingRoute } from '@/utils/postAuthRouting';
import { extractApiError } from '@/utils/apiErrors';

type ParamValue = string | string[] | undefined;
type VerificationRequestResponse = {
  dev_verification_code?: string | null;
};

type ApiErrorLike = {
  status?: number;
  response?: {
    status?: number;
  };
};

const toSingleValue = (value: ParamValue): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const getErrorStatus = (value: unknown): number | null => {
  const error = value as ApiErrorLike | null | undefined;
  return error?.status ?? error?.response?.status ?? null;
};

function VerifyScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { checkAuth } = useAuth();
  const params = useLocalSearchParams<{ devCode?: ParamValue }>();
  
  const [screenInfo, setScreenInfo] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any errors from previous screens on mount
  useEffect(() => {
    setScreenError(null);
    setScreenInfo(null);
    return () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); };
  }, []);

  const gate = useVerificationGate({
    requestCode: () => User.requestVerification(),
    confirmCode: (code: string) => User.verifyEmail(code),
    autoFinishOnVerified: false,
    resendCooldownSeconds: 60,
    getRequestSuccessState: (res: VerificationRequestResponse) => ({
      info: __DEV__ && res?.dev_verification_code ? `Code sent (dev: ${res.dev_verification_code})` : 'Code sent',
      cooldownSeconds: 60,
    }),
    getConfirmErrorMessage: (e: unknown) =>
      extractApiError(e, 'Verification failed').message,
    getRequestErrorMessage: (e: unknown) =>
      extractApiError(e, 'Resend failed').message,
    onVerified: async () => {
      await checkAuth().catch(() => {});
      setScreenInfo('✅ Email verified successfully!');
      setScreenError(null);
      setIsVerified(true);

      try {
        const userInfo = await User.me();
        const targetRoute = getPostAuthLandingRoute(userInfo);
        redirectTimerRef.current = setTimeout(() => {
          router.replace(targetRoute as Href);
        }, 3000);
      } catch (meErr) {
        const status = getErrorStatus(meErr);
        if (status === 401 || status === 403) {
          setScreenError('Your session expired. Please sign in again.');
          redirectTimerRef.current = setTimeout(() => router.replace('/sign-in'), 2000);
        } else {
          setScreenError('Could not load your profile. Tap Continue to retry.');
        }
      }
    },
  });
  const { code, error, info, loading, resend, resendCooldown, setCode, verify } = gate;

  // Require exactly 6-digit code for email verification
  const codeValid = code.trim().length === 6;
  const canVerify = !loading && codeValid;
  const isResendDisabled = loading || resendCooldown > 0;

  // Load dev code from params if available
  useEffect(() => {
    const fromParams = toSingleValue(params.devCode);
    if (fromParams) {
      setDevCode(fromParams);
      setCode(fromParams);
    }
  }, [params.devCode, setCode]);

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
    try {
      const userInfo = await User.me();
      router.replace(getPostAuthLandingRoute(userInfo) as Href);
    } catch (err) {
      // v1.0.2 pass 12: distinguish auth errors (401/403) from transient network
      // failures. Previously every error dumped the user into step-1-role even
      // when onboarding was already complete — see the onVerify handler above.
      const status = getErrorStatus(err);
      if (status === 401 || status === 403) {
        setScreenError('Your session expired. Please sign in again.');
        router.replace('/sign-in');
      } else {
        setScreenError('Could not load your profile. Please try again.');
      }
    }
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{ 
          title: 'Verify Your Account',
          headerShown: false,
        }} 
      />
      <KeyboardAwareScreen contentContainerStyle={styles.content}>
        {/* Back Button */}
        <Pressable 
          onPress={() => { safeGoBack(router); }}
          style={styles.backButton}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors[colorScheme].text} />
        </Pressable>
        
        {/* Header Icon */}
        <View style={styles.iconContainer}>
          <MaterialIcons 
            name="mail-outline" 
            size={64} 
            color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} 
          />
        </View>
        
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
          Check Your Email
        </Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
          We sent a 6-digit verification code to your email address.
        </Text>
        
        {screenError || error ? <Text style={styles.error}>{screenError || error}</Text> : null}
        {screenInfo || info ? <Text style={styles.info}>{screenInfo || info}</Text> : null}
        
        {devCode ? (
          <View style={styles.devCodeContainer}>
            <MaterialIcons name="bug-report" size={16} color="#059669" />
            <Text style={styles.devCodeText}>Dev Code: {devCode}</Text>
          </View>
        ) : null}

        <View style={styles.codeSection}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Verification Code</Text>
          <Input
            placeholder="Enter 6-digit code"
            value={code}
            onChangeText={(t: string) => {
              const cleaned = t.replace(/[^0-9]/g, '');
              setCode(cleaned);
              // v1.0.2: auto-submit at 6 digits so users aren't stuck (parity with verify.tsx)
              if (cleaned.length === 6) {
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
          <Button onPress={onVerify} disabled={!canVerify} style={styles.verifyButton}>
            {loading ? <ActivityIndicator color="#fff" /> : 'Verify Email'}
          </Button>
        )}
        
        {!isVerified && (
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: Colors[colorScheme].mutedText }]}>Didn't receive the code?</Text>
            <Pressable onPress={onResend} disabled={isResendDisabled}>
              <Text
                style={[
                  styles.linkText,
                  { color: Colors[colorScheme].tint },
                  isResendDisabled && styles.linkTextDisabled
                ]}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </Text>
            </Pressable>
          </View>
        )}
        
        {!isVerified && (
          <Pressable style={styles.skipButton} onPress={() => safeGoBack(router)}>
            <Text style={[styles.skipText, { color: Colors[colorScheme].mutedText }]}>Go back</Text>
          </Pressable>
        )}
        
        {isVerified && (
          <Text style={[styles.autoRedirectText, { color: Colors[colorScheme].mutedText }]}>
            Automatically continuing in a few seconds...
          </Text>
        )}
      </KeyboardAwareScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  content: { flexGrow: 1, justifyContent: 'center' },
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
});

export default VerifyScreen;
