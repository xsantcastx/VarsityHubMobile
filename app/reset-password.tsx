import { User } from '@/api/entities';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { extractApiError } from '@/utils/apiErrors';
import { analytics, ANALYTICS_EVENTS } from '@/utils/analytics';
import { captureBreadcrumb, captureException } from '@/utils/sentry';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
    useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState(typeof params.code === 'string' ? params.code : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const submitInFlightRef = useRef(false);

  const onSubmit = async () => {
    if (submitInFlightRef.current) return;
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (!trimmedEmail || !trimmedCode) {
      setError('Enter your email and reset code.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
      setError('Enter the 6-digit code from your email.');
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
    submitInFlightRef.current = true;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setInfo(null);
    captureBreadcrumb('Password reset submitted', 'auth.password_reset', {
      code_length: trimmedCode.length,
      source: 'reset-screen',
    });
    try {
      await User.resetPassword(trimmedEmail, trimmedCode, password);
      captureBreadcrumb('Password reset succeeded', 'auth.password_reset', {
        source: 'reset-screen',
      });
      analytics.track(ANALYTICS_EVENTS.PASSWORD_RESET_COMPLETED, {
        source: 'reset-screen',
      });
      setInfo('Password updated! You can sign in with your new password.');
      setResetSuccess(true);
    } catch (e: any) {
      captureBreadcrumb('Password reset failed', 'auth.password_reset', {
        code_length: trimmedCode.length,
        source: 'reset-screen',
      }, 'warning');
      captureException(e instanceof Error ? e : new Error(String(e)), {
        tags: { context: 'reset_password_screen_submit' },
      });
      const apiError = extractApiError(e, 'Unable to reset password.');
      setErrorCode(apiError.code);
      switch (apiError.code) {
        case 'RESET_CODE_EXPIRED':
          setError('This reset code expired. Request a new code and try again.');
          break;
        case 'RESET_CODE_INVALID':
          setError('This reset code is invalid. Request a new code and try again.');
          break;
        default:
          setError(apiError.message);
          break;
      }
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{
        title: 'Reset Password',
        headerShown: true,
        headerLeft: () => (
          <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingLeft: 8 }}>
            <MaterialIcons name="chevron-left" size={24} color={palette.tint} />
          </Pressable>
        ),
      }} />
      <KeyboardAwareScreen contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>Enter your reset code</Text>
          <Text style={[styles.subtitle, { color: palette.mutedText }]}>We sent a reset code to your email. Enter it with your new password.</Text>

          {error ? (
            <>
              <Text style={[styles.error, { color: '#b91c1c' }]}>{error}</Text>
              {(errorCode === 'RESET_CODE_EXPIRED' || errorCode === 'RESET_CODE_INVALID') && (
                <Pressable onPress={() => router.replace('/forgot-password')} style={{ marginTop: 4, marginBottom: 8 }}>
                  <Text style={{ color: palette.tint, fontWeight: '600', fontSize: 14 }}>Request a new code</Text>
                </Pressable>
              )}
            </>
          ) : null}
          {info ? <Text style={[styles.info, { color: '#065F46' }]}>{info}</Text> : null}

          {resetSuccess ? (
            <Pressable
              onPress={() => router.replace('/sign-in')}
              style={{ backgroundColor: palette.tint, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Back to Sign In</Text>
            </Pressable>
          ) : null}

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

          <Input
            placeholder="6-digit code from email"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
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
            placeholder="New password (min 8 characters)"
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

          <Input
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
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

          <Button onPress={onSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : 'Update password'}
          </Button>
        </View>

        <Pressable style={styles.secondary} onPress={() => void router.replace('/sign-in')}>
          <Text style={[styles.secondaryText, { color: palette.tint }]}>Back to sign in</Text>
        </Pressable>
      </KeyboardAwareScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
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
  info: {
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
});
