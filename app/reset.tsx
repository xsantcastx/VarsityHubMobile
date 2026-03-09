import { User } from '@/api/entities';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
    useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState('');
  const [code, setCode] = useState(typeof params.code === 'string' ? params.code : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); };
  }, []);

  // Extract code from URL on web
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const match = path.match(/\/reset\/([a-zA-Z0-9]+)/);
      if (match?.[1]) {
        setCode(match[1]);
      }
    }
  }, []);

  const onSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!trimmedCode) {
      setError('Invalid or missing reset code.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await User.resetPassword(trimmedEmail, trimmedCode, password);
      setSuccess(true);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      // Redirect to sign-in after 2 seconds
      redirectTimerRef.current = setTimeout(() => {
        void router.push('/sign-in');
      }, 2000);
    } catch (e: any) {
      setError(e?.message || 'Unable to reset password. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Reset Password', headerShown: false }} />
      <KeyboardAwareScreen contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
          {success ? (
            <>
              <Text style={[styles.title, { color: '#10b981' }]}>✓ Password Reset Successfully</Text>
              <Text style={[styles.subtitle, { color: palette.mutedText }]}>
                Your password has been updated. Redirecting to sign in...
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: palette.text }]}>Reset your password</Text>
              <Text style={[styles.subtitle, { color: palette.mutedText }]}>
                Enter your email and create a new password.
              </Text>

              {error ? <Text style={[styles.error, { color: '#b91c1c' }]}>❌ {error}</Text> : null}

              <Input
                placeholder="name@school.edu"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={palette.mutedText}
                editable={!loading}
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    borderColor: error ? '#b91c1c' : palette.border,
                    backgroundColor: palette.background,
                  },
                ]}
              />

              <Input
                placeholder="Enter new password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={palette.mutedText}
                editable={!loading}
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    borderColor: error ? '#b91c1c' : palette.border,
                    backgroundColor: palette.background,
                  },
                ]}
              />

              <Input
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholderTextColor={palette.mutedText}
                editable={!loading}
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    borderColor: error ? '#b91c1c' : palette.border,
                    backgroundColor: palette.background,
                  },
                ]}
              />

              {code && (
                <Text style={[styles.codeDisplay, { color: palette.mutedText }]}>
                  Reset Code: {code}
                </Text>
              )}

              <Button
                onPress={onSubmit}
                disabled={loading}
                style={styles.button}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Reset Password</Text>
                )}
              </Button>

              <Text style={[styles.helpText, { color: palette.mutedText }]}>
                Remember your password?{' '}
                <Text
                  style={[styles.link, { color: '#10b981' }]}
                  onPress={() => void router.push('/sign-in')}
                >
                  Sign in
                </Text>
              </Text>
            </>
          )}
        </View>
      </KeyboardAwareScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  input: {
    height: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    marginVertical: 8,
  },
  error: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  codeDisplay: {
    fontSize: 12,
    fontWeight: '500',
    marginVertical: 8,
  },
  button: {
    marginTop: 24,
    minHeight: 48,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  link: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
