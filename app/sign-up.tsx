import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getColors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useAppleAuth } from '@/hooks/useAppleAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureException } from '@/utils/sentry';

export default function SignUpScreen() {
  const router = useRouter();
  const { checkAuth } = useAuth();
  const colorScheme = useColorScheme();
  const palette = getColors(colorScheme);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { ready: googleReady, loading: googleLoading, signInWithGoogle } = useGoogleAuth();
  const { ready: appleReady, loading: appleLoading, signInWithApple } = useAppleAuth();

  const onEmailPasswordSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res: any = await User.register(trimmed, password, displayName.trim() || undefined);
      if (!res?.access_token) {
        captureException(new Error('Invalid registration response'), {
          tags: { context: 'email-password-register' },
          extra: { hasResponse: !!res },
        });
        setError('Registration failed. Please try again.');
        return;
      }
      await checkAuth({ email: trimmed, pendingVerification: true });
    } catch (e: any) {
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'email-password-register' },
      });
      const msg = e?.message || e?.data?.error || 'Registration failed.';
      if (e?.status === 409 || msg.toLowerCase().includes('already registered')) {
        setError('This email is already registered. Sign in instead.');
      } else if (e?.message?.includes('Network') || e?.status === 0) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    if (!googleReady) return;
    setError(null);
    try {
      const res: any = await signInWithGoogle();
      if (res?.needs_verification && res?.email) {
        await checkAuth({ email: res.email, pendingVerification: true });
      } else {
        await checkAuth();
      }
    } catch (e: any) {
      if (e?.code === 'CANCELLED' || e?.message === 'GOOGLE_SIGN_IN_CANCELLED') {
        return;
      }
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'google-signup' },
      });
      setError(e?.message || 'Google sign-up failed.');
    }
  };

  const onAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      setError('Apple sign in is only available on iOS.');
      return;
    }
    if (!appleReady) return;
    setError(null);
    try {
      await signInWithApple();
      await checkAuth();
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('cancel')) return;
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'apple-signup' },
      });
      setError(e?.message || 'Apple sign-up failed.');
    }
  };

  const oauthLoading = googleLoading || appleLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Sign Up', headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: palette.mutedText }]}>
          Sign up with your email or continue with Google or Apple.
        </Text>

        {error ? <Text style={[styles.error, { color: palette.destructive }]}>{error}</Text> : null}

        <Input
          placeholder="Display name (optional)"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
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

        <Input
          placeholder="name@school.edu"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
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

        <Input
          placeholder="Password (min 8 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
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

        <Button onPress={onEmailPasswordSubmit} disabled={loading || oauthLoading}>
          {loading ? <ActivityIndicator color="white" /> : 'Create Account'}
        </Button>

        {googleReady && (
          <Button
            variant="outline"
            onPress={onGoogleSignIn}
            disabled={loading || oauthLoading}
            style={[styles.oauthButton, { borderColor: palette.border }]}
          >
            {googleLoading ? (
              <ActivityIndicator color={palette.text} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={palette.text} />
                <Text style={[styles.oauthText, { color: palette.text }]}>Continue with Google</Text>
              </>
            )}
          </Button>
        )}

        {Platform.OS === 'ios' && appleReady && (
          <Button
            variant="outline"
            onPress={onAppleSignIn}
            disabled={loading || oauthLoading}
            style={[styles.oauthButton, { borderColor: palette.border }]}
          >
            {appleLoading ? (
              <ActivityIndicator color={palette.text} />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color={palette.text} />
                <Text style={[styles.oauthText, { color: palette.text }]}>Continue with Apple</Text>
              </>
            )}
          </Button>
        )}
      </View>

      <Pressable style={styles.secondary} onPress={() => void router.replace('/sign-in')}>
        <Text style={[styles.secondaryText, { color: palette.tint }]}>
          Already have an account? Sign in
        </Text>
      </Pressable>

      <View style={styles.legalLinks}>
        <Text style={[styles.legalText, { color: palette.mutedText }]}>
          By signing up, you agree to our{' '}
          <Text style={[styles.legalLink, { color: palette.tint }]} onPress={() => WebBrowser.openBrowserAsync('https://varsityhub.app/privacy')}>
            Privacy Policy
          </Text>
          {' '}and{' '}
          <Text style={[styles.legalLink, { color: palette.tint }]} onPress={() => WebBrowser.openBrowserAsync('https://varsityhub.app/terms')}>
            Terms of Service
          </Text>
          .
        </Text>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    fontWeight: '600',
  },
  input: {
    marginTop: 4,
  },
  secondary: {
    marginTop: 24,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  oauthText: {
    fontSize: 16,
    fontWeight: '600',
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  legalLinks: {
    marginTop: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  legalText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  legalLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
