import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type VerificationMethod = 'email' | 'phone';

type ParamValue = string | string[] | undefined;

const toSingleValue = (value: ParamValue): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const normalizeMethodParam = (value: ParamValue): VerificationMethod => {
  const normalized = toSingleValue(value);
  return normalized === 'phone' ? 'phone' : 'email';
};

const normalizePhoneNumber = (value: string): string | null => {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `+${digits}`;
};

export default function VerifyScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const params = useLocalSearchParams<{ devCode?: ParamValue; phone?: ParamValue; method?: ParamValue }>();
  
  const [method, setMethod] = useState<VerificationMethod>(() => normalizeMethodParam(params.method));
  const [phone, setPhone] = useState(() => toSingleValue(params.phone) || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const handleMethodChange = (nextMethod: VerificationMethod) => {
    if (nextMethod === method) return;
    setMethod(nextMethod);
    setCode('');
    setInfo(null);
    setError(null);
    setIsVerified(false);
  };

  const methodCopy = method === 'email'
    ? {
        icon: 'mail-outline' as const,
        title: 'Check Your Email',
        description: 'We sent a 6-digit verification code to your email address.',
        verifyCta: 'Verify Email',
        helper: 'Need to update your email? Edit it from settings.',
      }
    : {
        icon: 'chatbubble-ellipses-outline' as const,
        title: 'Verify Your Phone',
        description: 'Enter your phone number and we will text you a 6-digit code.',
        verifyCta: 'Verify Phone',
        helper: 'Include your country code (e.g. +1 for the US).',
      };

  const isPhoneReady = method === 'phone' ? Boolean(normalizePhoneNumber(phone)) : true;
  const canVerify = !loading && code.trim().length >= 4 && isPhoneReady;
  const isResendDisabled = loading || (method === 'phone' && !isPhoneReady);

  // Load dev code from params if available
  useEffect(() => {
    const fromParams = toSingleValue(params.devCode);
    if (fromParams) {
      setDevCode(fromParams);
      setCode(fromParams);
      console.log('[verify] Dev code loaded from params:', fromParams);
    }
  }, [params.devCode]);

  const onVerify = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null); setInfo(null);
    try {
      let result;
      if (method === 'email') {
        console.log('[verify] Attempting to verify email with code:', code.trim());
        result = await User.verifyEmail(code.trim());
        console.log('[verify] Email verification result:', result);
        setInfo('✅ Email verified successfully!');
      } else {
        const sanitizedPhone = normalizePhoneNumber(phone);
        if (!sanitizedPhone) {
          setError('Please enter a valid phone number including country code.');
          return;
        }
        console.log('[verify] Attempting to verify phone with code:', code.trim(), 'phone:', sanitizedPhone);
        result = await User.verifyPhone(sanitizedPhone, code.trim());
        console.log('[verify] Phone verification result:', result);
        setInfo('✅ Phone verified successfully!');
      }
      
      setCode(''); // Clear the code input
      setIsVerified(true);
      
      // After successful verification, check if user needs onboarding
      try {
        const userInfo = await User.me();
        console.log('[verify] User info after verification:', userInfo);
        
        const needsOnboarding = userInfo?.preferences?.onboarding_completed === false;
        
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          if (needsOnboarding) {
            console.log('[verify] Auto-redirecting to onboarding...');
            router.replace('/onboarding/step-1-role');
          } else {
            console.log('[verify] Auto-redirecting to main app...');
            router.replace('/(tabs)' as any);
          }
        }, 3000);
        
      } catch (userError) {
        console.error('[verify] Failed to get user info, defaulting to onboarding:', userError);
        setTimeout(() => {
          router.replace('/onboarding/step-1-role');
        }, 3000);
      }
    } catch (e: any) {
      console.error(`[verify] ${method} verification failed:`, e);
      const errorMsg = e?.message || e?.data?.error || 'Verification failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setLoading(true); setError(null); setInfo(null);
    try {
      if (method === 'email') {
        console.log('[verify] Requesting new email verification code...');
        const res: any = await User.requestVerification();
        console.log('[verify] Resend email response:', res);
        setInfo(res?.dev_verification_code ? `Code sent (dev: ${res.dev_verification_code})` : 'Code sent');
      } else {
        const sanitizedPhone = normalizePhoneNumber(phone);
        if (!sanitizedPhone) {
          setError('Please enter a valid phone number including country code.');
          return;
        }
        console.log('[verify] Requesting new SMS verification code for:', sanitizedPhone);
        const res: any = await User.requestPhoneVerification(sanitizedPhone);
        setInfo(res?.dev_verification_code ? `Code sent (dev: ${res.dev_verification_code})` : `Text sent to ${sanitizedPhone}`);
      }
    } catch (e: any) {
      console.error(`[verify] Resend ${method} failed:`, e);
      const errorMsg = e?.message || e?.data?.error || 'Resend failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const onContinue = async () => {
    console.log('[verify] User clicked Continue, proceeding immediately...');
    try {
      const userInfo = await User.me();
      const needsOnboarding = userInfo?.preferences?.onboarding_completed === false;
      
      if (needsOnboarding) {
        router.replace('/onboarding/step-1-role');
      } else {
        router.replace('/(tabs)' as any);
      }
    } catch (userError) {
      console.error('[verify] Failed to get user info:', userError);
      router.replace('/onboarding/step-1-role');
    }
  };

  const MethodToggle = () => (
    <View style={styles.toggleContainer}>
      <Pressable 
        style={[
          styles.toggleButton, 
          method === 'email' && styles.toggleButtonActive, 
          { backgroundColor: method === 'email' ? Colors[colorScheme].tint : 'transparent' }
        ]}
        onPress={() => handleMethodChange('email')}
      >
        <Ionicons name="mail-outline" size={20} color={method === 'email' ? 'white' : Colors[colorScheme].mutedText} />
        <Text style={[styles.toggleText, { color: method === 'email' ? 'white' : Colors[colorScheme].text }]}>Email</Text>
      </Pressable>
      <Pressable 
        style={[
          styles.toggleButton, 
          method === 'phone' && styles.toggleButtonActive, 
          { backgroundColor: method === 'phone' ? Colors[colorScheme].tint : 'transparent' }
        ]}
        onPress={() => handleMethodChange('phone')}
      >
        <Ionicons name="call-outline" size={20} color={method === 'phone' ? 'white' : Colors[colorScheme].mutedText} />
        <Text style={[styles.toggleText, { color: method === 'phone' ? 'white' : Colors[colorScheme].text }]}>Phone</Text>
      </Pressable>
    </View>
  );

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
          onPress={() => router.back()} 
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
        </Pressable>
        
        {/* Header Icon */}
        <View style={styles.iconContainer}>
          <Ionicons 
            name={methodCopy.icon} 
            size={64} 
            color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} 
          />
        </View>
        
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
          {methodCopy.title}
        </Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
          {methodCopy.description}
        </Text>
        
        <MethodToggle />
        
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        
        {method === 'email' && devCode ? (
          <View style={styles.devCodeContainer}>
            <Ionicons name="bug-outline" size={16} color="#059669" />
            <Text style={styles.devCodeText}>Dev Code: {devCode}</Text>
          </View>
        ) : null}
        
        {method === 'phone' && (
          <View style={styles.codeSection}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Phone Number</Text>
            <Input 
              placeholder="+1 (555) 123-4567" 
              value={phone} 
              onChangeText={setPhone} 
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              style={styles.phoneInput}
            />
            <Text style={[styles.helperText, { color: Colors[colorScheme].mutedText }]}>
              {methodCopy.helper}
            </Text>
          </View>
        )}

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
            {loading ? <ActivityIndicator color="#fff" /> : methodCopy.verifyCta}
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
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  toggleButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  codeSection: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  helperText: { fontSize: 12, marginTop: 6 },
  phoneInput: { fontSize: 16, letterSpacing: 1 },
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
