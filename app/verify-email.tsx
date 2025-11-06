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
import { useColorScheme } from '@/hooks/useColorScheme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const params = useLocalSearchParams<{ devCode?: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  // Load dev code from params if available
  useEffect(() => {
    if (params.devCode) {
      setDevCode(params.devCode);
      setCode(params.devCode);
      console.log('[verify-email] Dev code loaded from params:', params.devCode);
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
    } catch (error) {
      console.error('Failed to open email app:', error);
      setInfo('Please check your email app manually');
    }
  };

  const onVerify = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null); setInfo(null);
    try {
      console.log('[verify-email] Attempting to verify with code:', code.trim());
      const result = await User.verifyEmail(code.trim());
      console.log('[verify-email] Verification result:', result);
      setInfo('✅ Email verified successfully! You can go back now.');
      setCode(''); // Clear the code input
      // Don't auto-redirect - let user go back manually
    } catch (e: any) {
      console.error('[verify-email] Verification failed:', e);
      const errorMsg = e?.message || e?.data?.error || 'Verification failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setLoading(true); setError(null); setInfo(null);
    try {
      console.log('[verify-email] Requesting new verification code...');
      const res: any = await User.requestVerification();
      console.log('[verify-email] Resend response:', res);
      setInfo(res?.dev_verification_code ? `Code sent (dev: ${res.dev_verification_code})` : 'Code sent');
    } catch (e: any) {
      console.error('[verify-email] Resend failed:', e);
      const errorMsg = e?.message || e?.data?.error || 'Resend failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Verify Email' }} />
      
      {/* Header Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name="mail-outline" size={64} color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} />
      </View>
      
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Check Your Email</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
        We sent a 6-digit verification code to your email address. 
        Enter the code below to complete your registration.
      </Text>
      
      {/* Open Email App Button */}
      <Pressable style={styles.emailButton} onPress={openEmailApp}>
        <Ionicons name="mail-open-outline" size={20} color={Colors[colorScheme].tint} />
        <Text style={[styles.emailButtonText, { color: Colors[colorScheme].tint }]}>Open Email App</Text>
      </Pressable>
      
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
      
      <Button onPress={onVerify} disabled={loading || code.trim().length < 4} style={styles.verifyButton}>
        {loading ? <ActivityIndicator color="#fff" /> : 'Verify Email'}
      </Button>
      
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: Colors[colorScheme].mutedText }]}>Didn't receive the code?</Text>
        <Pressable onPress={onResend} disabled={loading}>
          <Text style={[styles.linkText, { color: Colors[colorScheme].tint }, loading && styles.linkTextDisabled]}>Resend Code</Text>
        </Pressable>
      </View>
      
      <Pressable style={styles.skipButton} onPress={() => router.replace('/onboarding/step-1-role')}>
        <Text style={[styles.skipText, { color: Colors[colorScheme].mutedText }]}>Skip for now</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
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
});
