import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      await User.verifyEmail(code.trim());
      setInfo('Email verified!');
      // After verification, start onboarding process
      router.replace('/onboarding/step-2-basic');
    } catch (e: any) {
      setError(e?.message || 'Verification failed');
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
      setError(e?.message || 'Resend failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Verify Email' }} />
      
      {/* Header Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name="mail-outline" size={64} color="#2563EB" />
      </View>
      
      <Text style={styles.title}>Check Your Email</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit verification code to your email address. 
        Enter the code below to complete your registration.
      </Text>
      
      {/* Open Email App Button */}
      <Pressable style={styles.emailButton} onPress={openEmailApp}>
        <Ionicons name="mail-open-outline" size={20} color="#2563EB" />
        <Text style={styles.emailButtonText}>Open Email App</Text>
      </Pressable>
      
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      
      <View style={styles.codeSection}>
        <Text style={styles.label}>Verification Code</Text>
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
        <Text style={styles.footerText}>Didn't receive the code?</Text>
        <Pressable onPress={onResend} disabled={loading}>
          <Text style={[styles.linkText, loading && styles.linkTextDisabled]}>Resend Code</Text>
        </Pressable>
      </View>
      
      <Pressable style={styles.skipButton} onPress={() => router.replace('/onboarding/step-2-basic')}>
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: 'white', justifyContent: 'center' },
  iconContainer: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 12, textAlign: 'center', color: '#111827' },
  subtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
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
  emailButtonText: { color: '#2563EB', fontSize: 16, fontWeight: '700' },
  codeSection: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  codeInput: { fontSize: 24, textAlign: 'center', letterSpacing: 8 },
  verifyButton: { marginBottom: 16 },
  footer: { alignItems: 'center', marginTop: 8, gap: 8 },
  footerText: { color: '#6b7280', fontSize: 14 },
  linkText: { color: '#2563EB', fontWeight: '700', fontSize: 14 },
  linkTextDisabled: { opacity: 0.5 },
  skipButton: { marginTop: 20, alignItems: 'center', paddingVertical: 12 },
  skipText: { color: '#9CA3AF', fontSize: 14 },
  error: { color: '#DC2626', marginBottom: 12, textAlign: 'center', fontSize: 14 },
  info: { color: '#059669', marginBottom: 12, textAlign: 'center', fontSize: 14 },
});
