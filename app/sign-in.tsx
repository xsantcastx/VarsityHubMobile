import { Image } from 'expo-image';
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
    useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useAppleAuth } from '@/hooks/useAppleAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { captureException } from '@/utils/sentry';
import * as AppleAuthentication from 'expo-apple-authentication';

const { AppleAuthenticationButton, AppleAuthenticationButtonType, AppleAuthenticationButtonStyle } = AppleAuthentication;

const GOOGLE_ICON_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'>
    <path fill='#4285F4' d='M44.5 20H24v8.5h11.8C34.4 33.7 29.7 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.3l6.4-6.4C34.6 4.4 29.6 2 24 2 12.3 2 2.5 11.8 2.5 23.5S12.3 45 24 45c11.3 0 21-8 21-22 0-1.7-.2-3.3-.5-5Z'/>
    <path fill='#34A853' d='M6.3 14.7 13.3 19.8C14.8 16.1 19 13 24 13c3.3 0 6.3 1.2 8.6 3.3l6.4-6.4C34.6 4.4 29.6 2 24 2 14.7 2 6.6 7.4 6.3 14.7Z'/>
    <path fill='#FBBC05' d='M24 45c5.5 0 10.5-1.8 14.5-4.8l-7-5.7c-2.1 1.4-4.7 2.3-7.5 2.3-7.2 0-13.3-5.8-13.9-13h-8v8C6 39.6 14.1 45 24 45Z'/>
    <path fill='#EA4335' d='M43.5 24c0-1.3-.2-2.7-.5-4H24v8.5h11.8c-.5 2.8-2 5.2-4.3 6.8l7 5.7C41.1 37.2 43.5 31.6 43.5 24Z'/>
  </svg>`
)}`;

const GoogleGlyph = ({ size = 20 }: { size?: number }) => (
  <Image source={{ uri: GOOGLE_ICON_URI }} style={{ width: size, height: size }} />
);

export default function SignInScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithGoogle, loading: googleLoading, ready: googleReady } = useGoogleAuth();
  const { signInWithApple } = useAppleAuth();
  const { checkAuth } = useAuth();

  const onSubmit = async () => {
    // SECURITY: Add client-side validation before API call
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    
    // SECURITY: Validate email format to prevent noisy backend 400s
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // SECURITY: Enforce minimum password length
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    // SECURITY: Prevent double submission on rapid taps
    if (loading) return;
    
    setLoading(true);
    setError(null);
    try {
      const res: any = await User.loginViaEmailPassword(email, password);
      
      if (!res?.access_token) {
        const errMsg = `Invalid login response: missing access_token. Response keys: ${Object.keys(res || {}).join(', ')}`;
        captureException(new Error(errMsg), { tags: { context: 'email-password-login', userId: email } });
        // SECURITY: Normalize error message to prevent leakage
        setError('Invalid email or password');
        return;
      }

      // If email verification is needed, call checkAuth with pendingVerification flag
      // AuthProvider will detect and navigate to /verify-email
      if (res?.needs_verification) {
        await checkAuth({ email, pendingVerification: true });
        // AuthProvider routing will handle the navigation to /verify-email
        return;
      }

      // Otherwise, refresh auth state - AuthProvider will handle routing
      await checkAuth();
    } catch (e: any) {
      // SECURITY: Normalize backend errors to user-friendly messages
      let userMessage = 'Invalid email or password';
      if (e?.response?.status === 429) {
        userMessage = 'Too many login attempts. Please try again later.';
      } else if (e?.response?.status === 500) {
        userMessage = 'Server error. Please try again later.';
      }
      
      // Capture detailed error for debugging, don't expose to user
      captureException(
        typeof e === 'string' ? new Error(e) : e,
        {
          tags: { context: 'email-password-login', userId: email },
          extra: { response: e?.data?.error || e?.response?.data },
        }
      );
      
      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // SECURITY: Prevent double submission
    if (googleLoading || loading) return;
    
    if (!googleReady) {
      setError('Google sign in is not configured yet.');
      return;
    }
    setError(null);
    try {
      const response: any = await signInWithGoogle();
      
      if (!response?.user?.email && !response?.email) {
        const errMsg = `Google sign-in failed: missing email in response. Response: ${JSON.stringify(response).substring(0, 200)}`;
        captureException(new Error(errMsg), { tags: { context: 'google-signin' } });
        // SECURITY: Normalize error message
        setError('Failed to sign in with Google. Please try again.');
        return;
      }

      // SECURITY: Verify server auth succeeded before routing
      if (!response?.access_token) {
        captureException(
          new Error('Google sign-in: missing access_token after backend linking'),
          { tags: { context: 'google-signin', email: response?.user?.email || response?.email } }
        );
        setError('Failed to sign in with Google. Please try again.');
        return;
      }

      // Call checkAuth to set user state; AuthProvider will handle routing
      await checkAuth();
      // AuthProvider will detect onboarding_completed and route accordingly
    } catch (e: any) {
      // Silently ignore user cancellation
      if (e?.code === 'CANCELLED' || e?.message === 'GOOGLE_SIGN_IN_CANCELLED') {
        return;
      }
      
      const message = e?.message || 'Google sign in failed';
      if (typeof message === 'string' && message.toLowerCase().includes('cancel')) {
        return;
      }
      
      captureException(
        typeof e === 'string' ? new Error(e) : e,
        { tags: { context: 'google-signin' } }
      );
      
      // SECURITY: Normalize error message
      setError('Failed to sign in with Google. Please try again.');
    }
  };

  const handleAppleLogin = async () => {
    // SECURITY: Prevent double submission
    if (loading) return;
    
    if (Platform.OS !== 'ios') {
      setError('Apple sign in is only available on iOS.');
      return;
    }
    setError(null);
    try {
      const response: any = await signInWithApple();
      
      if (!response?.user && !response?.email) {
        const errMsg = `Apple sign-in: missing user in response. Response: ${JSON.stringify(response).substring(0, 200)}`;
        captureException(new Error(errMsg), { tags: { context: 'apple-signin' } });
        // SECURITY: Normalize error message
        setError('Failed to sign in with Apple. Please try again.');
        return;
      }

      // SECURITY: Verify server auth succeeded before routing
      if (!response?.access_token) {
        captureException(
          new Error('Apple sign-in: missing access_token after backend linking'),
          { tags: { context: 'apple-signin', email: response?.user?.email || response?.email } }
        );
        setError('Failed to sign in with Apple. Please try again.');
        return;
      }

      // Call checkAuth to set user state; AuthProvider will handle routing
      await checkAuth();
      // AuthProvider will detect onboarding_completed and route accordingly
    } catch (e: any) {
      const message = e?.message || 'Apple sign in failed';
      const code = String(e?.code || '').toLowerCase();
      
      // Silently ignore user cancellation (not an error)
      if (
        message.toLowerCase().includes('cancel') ||
        code.includes('canceled') ||
        code.includes('cancelled') ||
        code === 'err_request_canceled'
      ) {
        return;
      }
      
      captureException(
        typeof e === 'string' ? new Error(e) : e,
        { tags: { context: 'apple-signin' } }
      );
      
      // SECURITY: Normalize error message
      setError('Failed to sign in with Apple. Please try again.');
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
            <View style={[styles.logoContainer, { backgroundColor: 'transparent', shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 }]}>
              <Image
                source={require('../assets/images/no-background-logo.svg')}
                style={styles.logo}
                contentFit="contain"
              />
            </View>
            <Text style={[styles.title, { color: palette.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: palette.mutedText }]}>Sign in to keep your community in sync.</Text>
          </View>

          <View style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
            {error ? (
              <Text style={[styles.error, { color: palette.tint }]}>{error}</Text>
            ) : null}

            {Platform.OS === 'ios' ? (
              <AppleAuthenticationButton
                onPress={handleAppleLogin}
                buttonType={AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={colorScheme === 'dark' ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={8}
                style={{ width: '100%', height: 50, marginBottom: 0 }}
              />
            ) : null}

            {googleReady ? (
              <Pressable
                style={[
                  styles.googleButton,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  googleLoading && styles.buttonDisabled,
                ]}
                onPress={handleGoogleLogin}
                disabled={googleLoading}
                accessibilityRole="button"
              >
                <View style={styles.googleIconInline}>
                  <GoogleGlyph size={20} />
                </View>
                {googleLoading ? (
                  <ActivityIndicator size="small" color={palette.text} />
                ) : (
                  <Text style={[styles.googleButtonText, { color: palette.text }]}>Continue with Google</Text>
                )}
              </Pressable>
            ) : (
              <View
                style={[
                  styles.googleButton,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                  styles.buttonDisabled,
                ]}
                accessibilityRole="text"
                accessibilityLabel="Google sign in not available"
              >
                <View style={[styles.googleIconInline, { opacity: 0.5 }]}>
                  <GoogleGlyph size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.googleButtonText, { color: palette.mutedText }]}>Google sign in unavailable</Text>
                  <Text style={[styles.googleButtonSubtext, { color: palette.mutedText }]}>Configure Google OAuth client IDs to enable one-tap login.</Text>
                </View>
              </View>
            )}

            <View style={styles.fieldSpacing}>
              <Text style={[styles.label, { color: palette.mutedText }]}>Email</Text>
              <Input
                placeholder="you@email.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
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
                autoCapitalize="none"
                autoCorrect={false}
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

            <Pressable style={styles.forgotLink} onPress={() => void router.push('/forgot-password')}>
              <Text style={[styles.forgotLinkText, { color: palette.tint }]}>Forgot password?</Text>
            </Pressable>

            <Button onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : 'Sign In'}
            </Button>
          </View>

          <Pressable style={styles.footer} onPress={() => void router.replace('/sign-up')}>
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
    width: 168,
    height: 132,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
    paddingVertical: 0,
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    elevation: 0,
  },
  logo: {
    width: 168,
    height: 120,
    resizeMode: 'contain',
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
    gap: 8,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  googleIconInline: {
    marginRight: 8,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  appleFallbackButton: {
    height: 44,
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  appleFallbackText: {
    fontSize: 16,
    fontWeight: '600',
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
