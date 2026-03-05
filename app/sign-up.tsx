import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAppleAuth } from '@/hooks/useAppleAuth';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { calculatePasswordStrength, sanitizeEmail, validateEmail, validatePassword } from '@/utils/formUtils';
import { captureException } from '@/utils/sentry';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as AppleAuthentication from 'expo-apple-authentication';

const { AppleAuthenticationButton, AppleAuthenticationButtonType, AppleAuthenticationButtonStyle } = AppleAuthentication;

export default function SignUpScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle, loading: googleLoading, ready: googleReady } = useGoogleAuth();
  const { signInWithApple, loading: appleLoading, ready: appleReady } = useAppleAuth();
  const { trackTap } = useAnalytics();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: 'Very weak' });

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value) {
      setPasswordStrength(calculatePasswordStrength(value));
    } else {
      setPasswordStrength({ score: 0, feedback: 'Very weak' });
    }
  };

  const attemptRegistration = async (attempt: number = 1): Promise<any> => {
    setRetryCount(attempt > 1 ? attempt : 0);
    
    try {
      const sanitizedEmail = sanitizeEmail(email);
      return await User.register(sanitizedEmail, password);
    } catch (e: any) {
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'email-signup-attempt' },
        extra: { attempt, email },
      });
      
      // Handle the race condition: if we get "Email already registered" on retry,
      // it likely means the first attempt actually succeeded but we didn't get the response
      if (attempt > 1 && e?.message?.includes('Email already registered')) {
        try {
          // Try to sign in with the same credentials
          const loginResult = await User.loginViaEmailPassword(email, password);
          // Return the login result as if it was a successful registration
          return loginResult;
        } catch (loginError: any) {
          console.error(`[sign-up] Recovery login failed:`, loginError?.message);
          // If login fails, the user might not have been created after all
          // Or there might be a password issue - throw a helpful error
          throw new Error('Registration may have partially succeeded but login failed. Please try signing in directly or contact support.');
        }
      }
      
      // Only retry on timeout or network errors, not validation errors
      const isRetryableError = e?.message?.includes('Request timeout') || 
                              e?.message?.includes('Network request failed') ||
                              e?.message?.includes('fetch');
      
      if (isRetryableError && attempt < 3) {
        setRetryCount(attempt);
        // Wait a bit before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        return attemptRegistration(attempt + 1);
      } else {
        throw e; // Re-throw if not retryable or max attempts reached
      }
    }
  };

  const onSubmit = async () => {
    if (!email || !password) { setError('Please enter email and password'); return; }
    
    // Use form validation utilities
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) { setError(emailValidation.error || 'Invalid email'); return; }
    
    const passwordValidation = validatePassword(password, 8, true);
    if (!passwordValidation.valid) { setError(passwordValidation.error || 'Invalid password'); return; }
    
    trackTap('auth_email_submit', { screen: 'sign_up' });
    setLoading(true); setError(null); setRetryCount(0); setShowSignInPrompt(false);
    
    try {
      const res: any = await attemptRegistration();
      // After successful signup, redirect to email verification screen
      // Pass dev code if available for easier testing
      if (res?.dev_verification_code) {
        router.replace(`/verify?devCode=${res.dev_verification_code}`);
      } else {
        router.replace('/verify');
      }
    } catch (e: any) {
      console.error('[sign-up] Registration failed after all attempts:', e);
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'email-signup-final' },
        extra: { email },
      });
      
      // Handle specific error types with better messaging
      let errorMessage = 'Sign up failed';
      let promptSignIn = false;
      
      if (e?.message?.includes('Registration may have partially succeeded')) {
        errorMessage = 'Your account may have been created but there was an issue signing you in. Please try signing in directly.';
        promptSignIn = true;
      } else if (e?.message?.includes('Email already registered') || e?.status === 409 || e?.data?.errorCode === 'EMAIL_ALREADY_REGISTERED') {
        errorMessage = 'This email is already registered. Please sign in instead.';
        promptSignIn = true;
      } else if (e?.message?.includes('Request timeout')) {
        errorMessage = 'Registration is taking longer than expected. Our servers might be busy. Please try again in a few minutes.';
      } else if (e?.message?.includes('Network request failed')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (e?.message?.includes('password')) {
        errorMessage = 'Password must be at least 8 characters and contain letters and numbers.';
      } else if (e?.message?.includes('email')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (e?.message) {
        errorMessage = e.message;
      }
      
      setError(errorMessage);
      setShowSignInPrompt(promptSignIn);
    } finally { setLoading(false); }
  };

  const handleGoogleSignUp = async () => {
    if (!googleReady) {
      setError('Google sign up is not configured yet. Please use email for now.');
      return;
    }
    setError(null);
    try {
      trackTap('auth_google_tap', { screen: 'sign_up' });
      const response: any = await signInWithGoogle();
      const account = response?.user || (await User.me());
      const prefs = account?.preferences || {};
      const needsOnboarding = response?.needs_onboarding === true || prefs?.onboarding_completed === false;
      if (needsOnboarding) {
        router.replace('/onboarding/step-1-role');
        return;
      }
      // Everyone lands on feed
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      const message = e?.message || 'Google sign up failed';
      if (typeof message === 'string' && message.toLowerCase().includes('cancel')) {
        return;
      }
      captureException(typeof e === 'string' ? new Error(e) : e, { tags: { context: 'google-signup' } });
      setError(message);
    }
  };

  const handleAppleSignUp = async () => {
    if (Platform.OS !== 'ios') {
      setError('Apple sign in is only available on iOS.');
      return;
    }
    if (!appleReady) {
      setError('Apple sign in is still initializing. Please try again in a moment.');
      return;
    }
    if (appleLoading) {
      return;
    }
    setError(null);
    try {
      trackTap('auth_apple_tap', { screen: 'sign_up' });
      const response: any = await signInWithApple();
      
      // The response includes both access_token and user data
      // Check needs_onboarding from the auth response directly
      const needsOnboarding = response?.needs_onboarding === true;
      
      if (needsOnboarding) {
        router.replace('/onboarding/step-1-role');
        return;
      }
      
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      console.error('[sign-up] Apple sign up error:', e);
      captureException(typeof e === 'string' ? new Error(e) : e, { tags: { context: 'apple-signup' } });
      const message = e?.message || 'Apple sign up failed';
      if (typeof message === 'string' && message.toLowerCase().includes('cancel')) {
        return;
      }
      setError(message);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{ 
          title: 'Create Account',
          headerShown: true,
          headerBackTitle: 'Back'
        }} 
      />
      <KeyboardAwareScreen contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>Choose how you'd like to sign up</Text>
        
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.error, { color: Colors[colorScheme].destructive }]}>{error}</Text>
            {showSignInPrompt && (
              <Button 
                variant="outline" 
                onPress={() => router.replace('/sign-in')}
                style={{ marginTop: 12 }}
              >
                <Text style={{ color: Colors[colorScheme].tint, fontSize: 16, fontWeight: '600' }}>Go to Sign In</Text>
              </Button>
            )}
          </View>
        ) : null}

        {!showEmailForm ? (
          <>
          <Text style={[styles.legalText, { color: Colors[colorScheme].mutedText }]}>
            By signing up, you agree to our{' '}
            <Text
              style={{ color: Colors[colorScheme].tint, textDecorationLine: 'underline' }}
              onPress={() => void router.push('/settings/terms-of-service')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={{ color: Colors[colorScheme].tint, textDecorationLine: 'underline' }}
              onPress={() => void router.push('/settings/privacy-policy')}
            >
              Privacy Policy
            </Text>
          </Text>

          {/* Apple Sign Up Option (iOS only) */}
          {Platform.OS === 'ios' ? (
            <AppleAuthenticationButton
              onPress={handleAppleSignUp}
              buttonType={AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={colorScheme === 'dark' ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              style={{ width: '100%', height: 50, marginBottom: 8 }}
            />
          ) : null}

          {/* Google Sign Up Option */}
          {googleReady ? (
            <Pressable
              style={[styles.googleButton, googleLoading && styles.buttonDisabled, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
              onPress={handleGoogleSignUp}
              disabled={googleLoading}
              accessibilityRole="button"
            >
              <MaterialIcons name="g-mobiledata" size={20} color="#4285F4" style={styles.googleIcon} />
              {googleLoading ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <Text style={[styles.googleButtonText, { color: Colors[colorScheme].text }]}>Continue with Google</Text>
              )}
            </Pressable>
          ) : (
            <View
              style={[styles.googleButton, styles.disabledGoogleButton, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
              accessibilityRole="text"
              accessibilityLabel="Google sign up not available"
            >
              <MaterialIcons name="g-mobiledata" size={20} color={Colors[colorScheme].mutedText} style={styles.googleIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.googleButtonText, { color: Colors[colorScheme].text }]}>Google sign up unavailable</Text>
                <Text style={[styles.googleButtonSubtext, { color: Colors[colorScheme].mutedText }]}>Add Google OAuth client IDs to enable this option.</Text>
              </View>
            </View>
          )}

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: Colors[colorScheme].border }]} />
            <Text style={[styles.dividerText, { color: Colors[colorScheme].mutedText }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: Colors[colorScheme].border }]} />
          </View>

          {/* Email Sign Up Option */}
          <Button onPress={() => setShowEmailForm(true)} variant="outline">
            <MaterialIcons name="mail" size={16} color={Colors[colorScheme].mutedText} style={{ marginRight: 8 }} />
            <Text style={{ color: Colors[colorScheme].text, fontSize: 16, fontWeight: '600' }}>Sign up with Email</Text>
          </Button>
        </>
        ) : (
          <>
          {/* Back Button */}
          <Pressable style={styles.backButton} onPress={() => setShowEmailForm(false)}>
            <MaterialIcons name="arrow-back" size={20} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.backText, { color: Colors[colorScheme].mutedText }]}>Back to options</Text>
          </Pressable>

          {/* Email Form */}
          <Input placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 10 }} />
          <Input placeholder="Password" value={password} onChangeText={handlePasswordChange} secureTextEntry />
          
          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                {[0, 1, 2, 3].map((index) => (
                  <View
                    key={index}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: index < passwordStrength.score
                        ? passwordStrength.score <= 1 ? '#ef4444'
                          : passwordStrength.score === 2 ? '#f59e0b'
                          : passwordStrength.score === 3 ? '#3b82f6'
                          : '#22c55e'
                        : Colors[colorScheme].border,
                    }}
                  />
                ))}
              </View>
              <Text style={{ fontSize: 12, color: Colors[colorScheme].text + '99' }}>
                Password strength: {passwordStrength.feedback}
              </Text>
              <Text style={{ fontSize: 11, color: Colors[colorScheme].text + '77', marginTop: 2 }}>
                Must contain: uppercase, lowercase, number, special character
              </Text>
            </View>
          )}
          
          <View style={{ height: 12 }} />
          <Text style={[styles.legalText, { color: Colors[colorScheme].mutedText }]}>
            By signing up, you agree to our{' '}
            <Text
              style={{ color: Colors[colorScheme].tint, textDecorationLine: 'underline' }}
              onPress={() => void router.push('/settings/terms-of-service')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={{ color: Colors[colorScheme].tint, textDecorationLine: 'underline' }}
              onPress={() => void router.push('/settings/privacy-policy')}
            >
              Privacy Policy
            </Text>
          </Text>
          <Button onPress={onSubmit} disabled={loading}>
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="white" />
                <Text style={{ color: 'white', marginLeft: 8, fontSize: 16 }}>
                  {retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Creating account...'}
                </Text>
              </View>
            ) : 'Sign Up'}
          </Button>
          </>
        )}

        <Pressable style={{ marginTop: 24, alignItems: 'center' }} onPress={() => void router.replace('/sign-in')}>
          <Text style={[styles.signInLink, { color: Colors[colorScheme].tint }]}>Already have an account? Sign in</Text>
        </Pressable>
      </KeyboardAwareScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  content: {
    flexGrow: 1,
  },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, marginBottom: 24, textAlign: 'center' },
  errorContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  error: { color: 'transparent', marginBottom: 8, textAlign: 'center' }, // Will be overridden with Colors[colorScheme].destructive
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent', // Will be overridden with Colors[colorScheme].card
    borderWidth: 1,
    borderColor: 'transparent', // Will be overridden with Colors[colorScheme].border
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
    color: 'transparent', // Will be overridden with Colors[colorScheme].text
  },
  googleButtonSubtext: {
    fontSize: 12,
    color: 'transparent', // Will be overridden with Colors[colorScheme].mutedText
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
    backgroundColor: 'transparent', // Will be overridden with Colors[colorScheme].border
  },
  dividerText: {
    marginHorizontal: 16,
    color: 'transparent', // Will be overridden with Colors[colorScheme].mutedText
    fontSize: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    marginLeft: 8,
    color: 'transparent', // Will be overridden with Colors[colorScheme].mutedText
    fontSize: 14,
  },
  signInLink: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 16,
  },
  legalText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  disabledGoogleButton: {
    borderColor: '#CBD5F5',
    backgroundColor: '#F3F4F6',
  },
});
