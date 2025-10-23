import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { Ionicons } from '@expo/vector-icons';

export default function SignInScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithGoogle, loading: googleLoading, ready: googleReady } = useGoogleAuth();

  const onSubmit = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res: any = await User.loginViaEmailPassword(email, password);
      if (res?.access_token) {
        if (res?.needs_verification) {
          // Navigate directly to email verification (no alert)
          router.replace('/verify-email');
        } else {
          // Successful sign-in - everyone lands on feed
          router.replace('/(tabs)/feed' as any);
        }
      } else {
        setError('Invalid login response');
        return;
      }
      if (res?.needs_verification) {
        Alert.alert('Verify Email', 'Please verify your email to continue.');
        router.replace('/verify-email');
        return;
      }

      const account = res?.user || (await User.me());
      const prefs = account?.preferences || {};
      const needsOnboarding = res?.needs_onboarding === true || prefs?.onboarding_completed === false;
      if (needsOnboarding) {
        router.replace('/onboarding/step-1-role');
        return;
      }

      // Everyone lands on feed after successful login
      Alert.alert('Signed in', 'Welcome back!');
      router.replace('/(tabs)/feed' as any);
    } catch (e: any) {
      console.error('Login failed', e);
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!googleReady) {
      setError('Google sign in is not configured yet.');
      return;
    }
    setError(null);
    try {
      const response: any = await signInWithGoogle();
      const account = response?.user || (await User.me());
      const prefs = account?.preferences || {};
      const needsOnboarding = response?.needs_onboarding === true || prefs?.onboarding_completed === false;
      if (needsOnboarding) {
        router.replace('/onboarding/step-1-role');
        return;
      }
      // Everyone lands on feed
      router.replace('/(tabs)/feed' as any);
    } catch (e: any) {
      const message = e?.message || 'Google sign in failed';
      if (typeof message === 'string' && message.toLowerCase().includes('cancel')) {
        return;
      }
      setError(message);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Sign In', headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: palette.card, shadowColor: colorScheme === 'dark' ? '#000000' : '#0f172a' }]}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logo}
                contentFit="contain"
              />
            </View>
            <Text style={[styles.title, { color: palette.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: palette.mutedText }]}>Sign in to keep your community in sync.</Text>
          </View>

          <View style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
            {error ? (
              <Text style={[styles.error, { color: '#b91c1c' }]}>{error}</Text>
            ) : null}

            {googleReady ? (
              <Pressable
                style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
                onPress={handleGoogleLogin}
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
                accessibilityLabel="Google sign in not available"
              >
                <Ionicons name="logo-google" size={20} color="#94a3b8" style={styles.googleIcon} />
                <View style={{ flex: 1 }}>
                <Text style={[styles.googleButtonText, { color: palette.mutedText }]}>Google sign in unavailable</Text>
                  <Text style={[styles.googleButtonSubtext, { color: palette.mutedText }]}>
                    Configure Google OAuth client IDs to enable one-tap login.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
              <Text style={[styles.dividerText, { color: palette.mutedText }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
            </View>

            <View style={styles.fieldSpacing}>
              <Text style={[styles.label, { color: palette.mutedText }]}>Email</Text>
              <Input
                placeholder="name@school.edu"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={palette.mutedText}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
              />
            </View>

            <View style={styles.fieldSpacing}>
              <Text style={[styles.label, { color: palette.mutedText }]}>Password</Text>
              <Input
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={palette.mutedText}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
              />
            </View>

            <Pressable style={styles.forgotLink} onPress={() => router.push('/forgot-password')}>
              <Text style={[styles.forgotLinkText, { color: palette.tint }]}>Forgot password?</Text>
            </Pressable>

            <Button onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : 'Sign In'}
            </Button>
          </View>

          <Pressable style={styles.footer} onPress={() => router.replace('/sign-up')}>
            <Text style={[styles.footerText, { color: palette.mutedText }]}>Need an account?</Text>
            <Text style={[styles.footerLink, { color: palette.tint }]}>Create one</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 88,
    height: 88,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 280,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    gap: 18,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  disabledGoogleButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
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
    marginTop: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  fieldSpacing: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    marginBottom: 0,
  },
  forgotLink: {
    alignSelf: 'flex-end',
  },
  forgotLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});







