import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { safeGoBack } from '@/utils/navigation';

type ParamValue = string | string[] | undefined;

const toSingleValue = (value: ParamValue): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export default function VerifyScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { checkAuth } = useAuth();
  const params = useLocalSearchParams<{ devCode?: ParamValue }>();
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any errors from previous screens on mount
  useEffect(() => {
    setError(null);
    setInfo(null);
    return () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); };
  }, []);

  // Require exactly 6-digit code for email verification
  const codeValid = code.trim().length === 6;
  const canVerify = !loading && codeValid;
  const isResendDisabled = loading;

  // Load dev code from params if available
  useEffect(() => {
    const fromParams = toSingleValue(params.devCode);
    if (fromParams) {
      setDevCode(fromParams);
      setCode(fromParams);
    }
  }, [params.devCode]);

  const onVerify = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null); setInfo(null);
    try {
      await User.verifyEmail(code.trim());
      await checkAuth().catch(() => {});
      setInfo('✅ Email verified successfully!');

      setCode(''); // Clear the code input
      setIsVerified(true);

      // After successful verification, check if user needs onboarding
      try {
        const userInfo = await User.me();
        const needsOnboarding = userInfo?.preferences?.onboarding_completed !== true;

        // Auto-redirect after 3 seconds
        redirectTimerRef.current = setTimeout(() => {
          if (needsOnboarding) {
            router.replace('/onboarding/step-1-role');
          } else {
            router.push('/(tabs)' as any);
          }
        }, 3000);

      } catch {
        redirectTimerRef.current = setTimeout(() => {
          router.replace('/onboarding/step-1-role');
        }, 3000);
      }
    } catch (e: any) {
      const errorMsg = e?.message || e?.data?.error || 'Verification failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setLoading(true); setError(null); setInfo(null);
    try {
      const res: any = await User.requestVerification();
      setInfo(__DEV__ && res?.dev_verification_code ? `Code sent (dev: ${res.dev_verification_code})` : 'Code sent');
    } catch (e: any) {
      const errorMsg = e?.message || e?.data?.error || 'Resend failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const onContinue = async () => {
    try {
      const userInfo = await User.me();
      const needsOnboarding = userInfo?.preferences?.onboarding_completed !== true;

      if (needsOnboarding) {
        router.replace('/onboarding/step-1-role');
      } else {
        router.push('/(tabs)' as any);
      }
    } catch {
      router.replace('/onboarding/step-1-role');
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
        
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        
        {devCode ? (
          <View style={styles.devCodeContainer}>
            <MaterialIcons name="bug-report" size={16} color="#059669" />
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
                Resend Code
              </Text>
            </Pressable>
          </View>
        )}
        
        {!isVerified && (
          <Pressable style={styles.skipButton} onPress={() => router.replace('/onboarding/step-1-role')}>
            <Text style={[styles.skipText, { color: Colors[colorScheme].mutedText }]}>Skip for now</Text>
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
