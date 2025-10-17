import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { Ionicons } from '@expo/vector-icons';

export default function SignUpScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle, loading: googleLoading, ready: googleReady } = useGoogleAuth();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true); setError(null);
    try {
      const res: any = await User.register(email, password, name || undefined);
      console.log('[sign-up] Registration response:', res);
      // After successful signup, redirect to email verification screen
      // Pass dev code if available for easier testing
      if (res?.dev_verification_code) {
        router.replace(`/verify-email?devCode=${res.dev_verification_code}`);
      } else {
        router.replace('/verify-email');
      }
    } catch (e: any) {
      console.error('[sign-up] Registration failed:', e);
      setError(e?.message || 'Sign up failed');
    } finally { setLoading(false); }
  };

  const handleGoogleSignUp = async () => {
    if (!googleReady) {
      setError('Google sign up is not configured yet. Please use email for now.');
      return;
    }
    setError(null);
    try {
      const response: any = await signInWithGoogle();
      const account = response?.user || (await User.me());
      const needsOnboarding = response?.needs_onboarding || account?.preferences?.onboarding_completed === false;
      if (needsOnboarding) {
        router.replace('/onboarding/step-2-basic');
        return;
      }
      // Everyone lands on feed
      router.replace('/(tabs)/feed' as any);
    } catch (e: any) {
      const message = e?.message || 'Google sign up failed';
      if (typeof message === 'string' && message.toLowerCase().includes('cancel')) {
        return;
      }
      setError(message);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Create Account' }} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Create Account</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>Choose how you'd like to sign up</Text>
      
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!showEmailForm ? (
        <>
          {/* Google Sign Up Option */}
          {googleReady ? (
            <Pressable
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogleSignUp}
              disabled={googleLoading}
              accessibilityRole="button"
            >
              <Ionicons name="logo-google" size={20} color="#4285F4" style={styles.googleIcon} />
              {googleLoading ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              )}
            </Pressable>
          ) : (
            <View
              style={[styles.googleButton, styles.disabledGoogleButton]}
              accessibilityRole="text"
              accessibilityLabel="Google sign up not available"
            >
              <Ionicons name="logo-google" size={20} color="#94a3b8" style={styles.googleIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.googleButtonText}>Google sign up unavailable</Text>
                <Text style={styles.googleButtonSubtext}>Add Google OAuth client IDs to enable this option.</Text>
              </View>
            </View>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Sign Up Option */}
          <Button onPress={() => setShowEmailForm(true)} variant="outline">
            <Ionicons name="mail" size={16} color="#6b7280" style={{ marginRight: 8 }} />
            Sign up with Email
          </Button>
        </>
      ) : (
        <>
          {/* Back Button */}
          <Pressable style={styles.backButton} onPress={() => setShowEmailForm(false)}>
            <Ionicons name="arrow-back" size={20} color="#6b7280" />
            <Text style={styles.backText}>Back to options</Text>
          </Pressable>

          {/* Email Form */}
          <Input placeholder="Display name (optional)" value={name} onChangeText={setName} style={{ marginBottom: 10 }} />
          <Input placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 10 }} />
          <Input placeholder="Password (min 8 chars)" value={password} onChangeText={setPassword} secureTextEntry />
          <View style={{ height: 12 }} />
          <Button onPress={onSubmit} disabled={loading}>
            {loading ? <ActivityIndicator /> : 'Sign Up'}
          </Button>
        </>
      )}

      <Pressable style={{ marginTop: 24, alignItems: 'center' }} onPress={() => router.replace('/sign-in')}>
        <Text style={[styles.signInLink, { color: Colors[colorScheme].tint }]}>Already have an account? Sign in</Text>
      </Pressable>
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, marginBottom: 24, textAlign: 'center' },
  error: { color: '#b91c1c', marginBottom: 8, textAlign: 'center' },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    marginRight: 8,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  googleButtonSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#6b7280',
    fontSize: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    marginLeft: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  signInLink: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 16,
  },
  disabledGoogleButton: {
    borderColor: '#CBD5F5',
    backgroundColor: '#F3F4F6',
  },
});
