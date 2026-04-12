import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useColorScheme
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useAppleAuth } from '@/hooks/useAppleAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { captureException } from '@/utils/sentry';
import { validateEmail } from '@/utils/formUtils';
import { analytics, ANALYTICS_EVENTS } from '@/utils/analytics';
import auth from '@/api/auth';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';

const {
  AppleAuthenticationButton,
  AppleAuthenticationButtonType,
  AppleAuthenticationButtonStyle,
} = AppleAuthentication;

export default function SignInScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { t } = useAppTranslation();

  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithGoogle, loading: googleLoading, ready: googleReady, isConfigured: googleConfigured } = useGoogleAuth();
  const { signInWithApple, loading: appleLoading } = useAppleAuth();
  const { checkAuth, registerPushToken } = useAuth();
  const insets = useSafeAreaInsets();

  const onSubmit = async () => {
    if (loading) return;
    if (!email || !password) {
      setError(t('auth.signIn.errors.enterEmailAndPassword'));
      return;
    }
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(t('auth.signIn.errors.invalidEmail'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res: any = await User.loginViaEmailPassword(email, password);

      if (!res?.access_token) {
        const errMsg = `Invalid login response: missing access_token. Response keys: ${Object.keys(res || {}).join(', ')}`;
        captureException(new Error(errMsg), { tags: { context: 'email-password-login' } });
        setError(t('auth.signIn.errors.invalidLoginResponse'));
        setLoading(false);
        return;
      }

      // If email verification is needed, call checkAuth with pendingVerification flag
      if (res?.needs_verification) {
        try {
          await checkAuth({ email, pendingVerification: true });
        } catch (authError) {
          // Token is saved, AuthProvider will handle routing on next render
          // eslint-disable-next-line no-console
          if (__DEV__) console.log('[sign-in] checkAuth after verification login:', authError);
        }
        setLoading(false);
        return;
      }

      // Otherwise, refresh auth state - AuthProvider will handle routing
      try {
        await checkAuth();
        analytics.track(ANALYTICS_EVENTS.USER_SIGNED_IN, { method: 'email' });
        // Register push token after successful login (non-blocking)
        registerPushToken().catch((err: any) => {
          captureException(err, { tags: { context: 'push-token-register-email-login' } });
        });
      } catch (authError) {
        // Token is saved, let AuthProvider handle routing
        // Don't show error - token is valid, routing will happen
        // eslint-disable-next-line no-console
        if (__DEV__) console.log('[sign-in] checkAuth after email login:', authError);
      }
    } catch (e: any) {
      const errMsg = e?.message || 'Login failed';
      const status = e?.status || e?.response?.status;
      
      // Show user-friendly error messages
      if (status === 401) {
        setError(t('auth.signIn.errors.invalidCredentials'));
      } else if (status === 429) {
        setError(t('auth.signIn.errors.tooManyAttempts'));
      } else if (status === 403) {
        const banReason = e?.data?.ban_reason || e?.response?.data?.ban_reason;
        const bannedUntil = e?.data?.banned_until || e?.response?.data?.banned_until;
        if (bannedUntil) {
          const until = new Date(bannedUntil).toLocaleDateString();
          setError(
            banReason
              ? t('auth.signIn.errors.suspendedUntilWithReason', { reason: banReason, until })
              : t('auth.signIn.errors.suspendedUntil', { until })
          );
        } else {
          setError(banReason || t('auth.signIn.errors.banned'));
        }
      } else if (errMsg.includes('Network') || errMsg.includes('timeout') || errMsg.includes('fetch')) {
        setError(t('auth.signIn.errors.network'));
      } else if (status === 500 || errMsg.toLowerCase().includes('internal server')) {
        setError(t('auth.signIn.errors.serverUnavailable'));
      } else {
        setError(errMsg || t('auth.signIn.errors.default'));
      }
      
      // Capture error with context
      captureException(
        typeof e === 'string' ? new Error(e) : e,
        {
          tags: { context: 'email-password-login' },
          extra: { response: e?.data?.error || e?.response?.data, status },
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!googleReady) {
      setError(t('auth.signIn.errors.googleNotConfigured'));
      return;
    }
    setError(null);
    // Clear any existing session so the new token is the only one in use (prevents wrong-account after Apple/Google)
    await auth.clearTokensOnly();
    try {
      const response: any = await signInWithGoogle();

      if (!response?.access_token) {
        const errMsg = `Google sign-in failed: missing access_token. Response: ${JSON.stringify(response).substring(0, 200)}`;
        captureException(new Error(errMsg), { tags: { context: 'google-signin' } });
        setError(t('auth.signIn.errors.googleFailed'));
        return;
      }

      // Call checkAuth to set user state; AuthProvider will handle routing
      try {
        await checkAuth();
        analytics.track(ANALYTICS_EVENTS.USER_SIGNED_IN, { method: 'google' });
        // Register push token after successful login (non-blocking)
        registerPushToken().catch((err: any) => {
          captureException(err, { tags: { context: 'push-token-register-google-login' } });
        });
      } catch (authError: any) {
        if (__DEV__) console.warn('[sign-in] checkAuth after Google login failed:', authError?.message);
        setError(t('auth.signIn.errors.profileLoadFailed'));
      }
    } catch (e: any) {
      // Silently ignore user cancellation
      if (e?.code === 'CANCELLED' || e?.message === 'GOOGLE_SIGN_IN_CANCELLED') {
        return;
      }

      const message = e?.message || 'Google sign in failed';
      if (typeof message === 'string' && message.toLowerCase().includes('cancel')) {
        return;
      }
      
      // Show user-friendly error
      if (message.includes('Network') || message.includes('timeout') || message.includes('fetch')) {
        setError(t('auth.signIn.errors.network'));
      } else if (message.includes('not configured')) {
        setError(t('auth.signIn.errors.googleUnavailableUseEmail'));
      } else {
        setError(message || t('auth.signIn.errors.googleFailed'));
      }
      
      captureException(
        typeof e === 'string' ? new Error(e) : e,
        { tags: { context: 'google-signin' } }
      );
    }
  };

  const handleAppleLogin = async () => {
    if (appleLoading) return;
    if (Platform.OS !== 'ios') {
      setError(t('auth.signIn.errors.appleOnlyIos'));
      return;
    }
    setError(null);
    // Clear any existing session so the new token is the only one in use (prevents wrong-account after Google/Apple)
    await auth.clearTokensOnly();
    try {
      const response: any = await signInWithApple();

      if (!response?.access_token) {
        const errMsg = `Apple sign-in failed: missing access_token. Response: ${JSON.stringify(response).substring(0, 200)}`;
        captureException(new Error(errMsg), { tags: { context: 'apple-signin' } });
        setError(t('auth.signIn.errors.appleFailed'));
        return;
      }

      // Call checkAuth to set user state; AuthProvider will handle routing
      try {
        await checkAuth();
        analytics.track(ANALYTICS_EVENTS.USER_SIGNED_IN, { method: 'apple' });
        // Register push token after successful login (non-blocking)
        registerPushToken().catch((err: any) => {
          captureException(err, { tags: { context: 'push-token-register-apple-login' } });
        });
      } catch (authError: any) {
        if (__DEV__) console.warn('[sign-in] checkAuth after Apple login failed:', authError?.message);
        setError(t('auth.signIn.errors.profileLoadFailed'));
      }
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
      
      // Show user-friendly error
      if (message.includes('not available in the simulator') || message.includes('simulator')) {
        setError(t('auth.signIn.errors.appleDeviceOnly'));
      } else if (message.includes('Network') || message.includes('timeout') || message.includes('fetch')) {
        setError(t('auth.signIn.errors.network'));
      } else if (message.toLowerCase().includes('internal server') || e?.status === 500) {
        setError(t('auth.signIn.errors.serverUnavailable'));
      } else {
        setError(message || t('auth.signIn.errors.appleFailed'));
      }

      captureException(
        typeof e === 'string' ? new Error(e) : e,
        { tags: { context: 'apple-signin' } }
      );
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background, borderLeftWidth: 0, borderRightWidth: 0 }]} edges={['top']}>
      <Stack.Screen options={{ title: t('auth.signIn.meta.title'), headerShown: false }} />
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(24, insets.bottom) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={[styles.flex, { borderWidth: 0 }]}
          automaticallyAdjustKeyboardInsets
        >
          <View style={[styles.header, { borderWidth: 0 }]}>
            <View style={[
              styles.logoContainer,
              {
                backgroundColor: '#FFFFFF',
                overflow: 'hidden',
                borderWidth: colorScheme === 'dark' ? 3 : 1,
                borderColor: colorScheme === 'dark' ? '#64748b' : '#E5E7EB',
                shadowColor: '#000000',
                shadowOpacity: colorScheme === 'dark' ? 0.6 : 0.1,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 16,
                elevation: 8,
              }
            ]}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logo}
                contentFit="contain"
                accessibilityLabel={t('auth.signIn.logoLabel')}
              />
            </View>
            <Text style={[styles.title, { color: palette.text }]}>{t('auth.signIn.title')}</Text>
            <Text style={[styles.subtitle, { color: palette.mutedText }]}>{t('auth.signIn.subtitle')}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border, borderWidth: 2 }]}>
            {error ? (
              <Text style={[styles.error, { color: palette.destructive }]}>{error}</Text>
            ) : null}

            {Platform.OS === 'ios' ? (
              <AppleAuthenticationButton
                onPress={handleAppleLogin}
                buttonType={AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={colorScheme === 'dark' ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={8}
                style={{ width: '100%', height: 50, marginBottom: 0, borderWidth: 2, borderColor: palette.border }}
                accessibilityLabel={t('auth.signIn.oauth.appleLabel')}
              />
            ) : null}

            {googleReady ? (
              <Pressable
                style={[styles.googleButton, googleLoading && styles.buttonDisabled, { backgroundColor: palette.card, borderColor: palette.border, borderWidth: 2 }]}
                onPress={handleGoogleLogin}
                disabled={googleLoading}
                accessibilityRole="button"
                accessibilityLabel={t('auth.signIn.oauth.googleLabel')}
                accessibilityHint={t('auth.signIn.oauth.googleHint')}
              >
                <Ionicons name="logo-google" size={20} color="#4285F4" style={styles.googleIcon} />
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#4285F4" />
                ) : (
                  <Text style={[styles.googleButtonText, { color: palette.text }]}>{t('auth.signIn.oauth.googleLabel')}</Text>
                )}
              </Pressable>
            ) : googleConfigured ? (
              // Client IDs are configured but the auth request hasn't initialized yet — show loading
              <View
                style={[styles.googleButton, styles.disabledGoogleButton, { backgroundColor: palette.card, borderColor: palette.border, borderWidth: 2 }]}
                accessibilityRole="text"
                accessibilityLabel={t('auth.signIn.oauth.googleLoading')}
              >
                <Ionicons name="logo-google" size={20} color={palette.mutedText} style={styles.googleIcon} />
                <ActivityIndicator size="small" color={palette.mutedText} style={{ marginLeft: 8 }} />
              </View>
            ) : (
              // Client IDs are genuinely missing — show unavailable
              <View
                style={[styles.googleButton, styles.disabledGoogleButton, { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 2 }]}
                accessibilityRole="text"
                accessibilityLabel={t('auth.signIn.oauth.googleUnavailable')}
              >
                <Ionicons name="logo-google" size={20} color={palette.mutedText} style={styles.googleIcon} />
                <View style={{ flex: 1 }}>
                <Text style={[styles.googleButtonText, { color: palette.mutedText }]}>{t('auth.signIn.oauth.googleUnavailable')}</Text>
                  <Text style={[styles.googleButtonSubtext, { color: palette.mutedText }]}>
                    {t('auth.signIn.oauth.googleUnavailableHelp')}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
              <Text style={[styles.dividerText, { color: palette.mutedText }]}>{t('common.actions.or')}</Text>
              <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
            </View>

            <View style={styles.fieldSpacing}>
              <Text style={[styles.label, { color: palette.mutedText }]}>{t('auth.signIn.fields.emailLabel')}</Text>
              <Input
                testID="sign-in-email"
                placeholder={t('common.placeholders.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholderTextColor={palette.mutedText}
                accessibilityLabel={t('auth.signIn.fields.emailA11yLabel')}
                accessibilityHint={t('auth.signIn.fields.emailA11yHint')}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderWidth: 2,
                    color: palette.text,
                  },
                ]}
              />
            </View>

            <View style={styles.fieldSpacing}>
              <Text style={[styles.label, { color: palette.mutedText }]}>{t('auth.signIn.fields.passwordLabel')}</Text>
              <Input
                ref={passwordRef}
                testID="sign-in-password"
                placeholder={t('auth.signIn.fields.passwordPlaceholder')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                placeholderTextColor={palette.mutedText}
                accessibilityLabel={t('auth.signIn.fields.passwordA11yLabel')}
                accessibilityHint={t('auth.signIn.fields.passwordA11yHint')}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderWidth: 2,
                    color: palette.text,
                  },
                ]}
              />
            </View>

            <Pressable
              style={styles.forgotLink}
              onPress={() => void router.push('/forgot-password')}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signIn.links.forgotPasswordLabel')}
              accessibilityHint={t('auth.signIn.links.forgotPasswordHint')}
            >
              <Text style={[styles.forgotLinkText, { color: palette.tint }]}>{t('auth.signIn.links.forgotPassword')}</Text>
            </Pressable>

            <Button
              onPress={onSubmit}
              disabled={loading}
              accessibilityLabel={loading ? t('auth.signIn.actions.submitting') : t('auth.signIn.actions.submit')}
              accessibilityHint={t('auth.signIn.actions.submitHint')}
            >
              {loading ? <ActivityIndicator color="white" /> : t('auth.signIn.actions.submit')}
            </Button>
          </View>

          <Pressable
            style={styles.footer}
            onPress={() => void router.replace('/sign-up')}
            accessibilityRole="button"
            accessibilityLabel={t('auth.signIn.actions.createOneLabel')}
            accessibilityHint={t('auth.signIn.actions.createOneHint')}
          >
            <Text style={[styles.footerText, { color: palette.mutedText }]}>{t('auth.signIn.actions.needAccount')}</Text>
            <Text style={[styles.footerLink, { color: palette.tint }]}>{t('auth.signIn.actions.createOne')}</Text>
          </Pressable>
        </ScrollView>
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
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  logo: {
    width: 85,
    height: 85,
    borderRadius: 10,
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
    borderWidth: 2,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    gap: 8,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent', // Will be overridden with palette.card
    borderWidth: 2,
    borderColor: 'transparent', // Will be overridden with palette.border
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  disabledGoogleButton: {
    backgroundColor: 'transparent', // Will be overridden with palette.surface
    borderColor: 'transparent', // Will be overridden with palette.border
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
    color: 'transparent', // Will be overridden with palette.text
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
    height: 1,
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
