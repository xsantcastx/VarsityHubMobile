import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const params = useLocalSearchParams<{ devCode?: string }>();
  const { pendingVerificationEmail, checkAuth } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // Redirect if user is not pending verification
  useEffect(() => {
    if (!pendingVerificationEmail) {
      router.replace('/sign-in');
    }
  }, [pendingVerificationEmail, router]);

  // Load dev code from params if available
  useEffect(() => {
    if (params.devCode) {
      setDevCode(params.devCode);
      setCode(params.devCode);
    }
  }, [params.devCode]);

  const openEmailApp = async () => {
    try {
      // Try to open native email app
      let url = '';
      if (Platform.OS === 'ios') {
        url = 'message://'; // iOS Mail app
      } else if (Platform.OS === 'android') {
        url = 'mailto:'; // Android email apps
      }
      
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to generic email URL
        await Linking.openURL('mailto:');
      }
    } catch (_error) {
      console.error('Failed to open email app:', error);
      setInfo('Please check your email app manually');
    }
  };

  const onVerify = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null); setInfo(null);
    try {
      await User.verifyEmail(code.trim());
      setInfo('✅ Email verified successfully!');
      setCode('');
      setIsVerified(true);
      
      // After successful verification, refresh auth state and navigate
      try {
        if (__DEV__) console.log('[verify-email] Refreshing auth after verification...');
        await checkAuth();
        
        // Give user brief moment to see success, then navigate
        setTimeout(() => {
          router.replace('/onboarding/step-1-role');
        }, 1500);
      } catch (userError) {
        console.error('[verify-email] Failed to refresh auth:', userError);
        setError('Verification successful but failed to load profile. Please sign in again.');
        setTimeout(() => router.replace('/sign-in'), 2000);
      }
    } catch (e: any) {
      console.error('[verify-email] Verification error:', e);
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
      setInfo(res?.dev_verification_code ? `Code sent (dev: ${res.dev_verification_code})` : 'Code sent');
    } catch (e: any) {
      console.error('[verify-email] Resend failed:', e);
      const errorMsg = e?.message || e?.data?.error || 'Resend failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
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
          title: 'Verify Email',
          headerShown: false,
        }} 
      />
      
      {/* Back Button */}
      <Pressable 
        onPress={() => void router.back()} 
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
        We sent a 6-digit verification code to your email address. 
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
  emailButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    backgroundColor: '#EFF6FF', 
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 12, 
    paddingVertical: 14, 
    paddingHorizontal: 20,
    marginBottom: 24
  },
  emailButtonText: { fontSize: 16, fontWeight: '700' },
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
