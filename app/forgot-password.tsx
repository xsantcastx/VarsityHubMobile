import { User } from '@/api/entities';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import PasswordInput from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { validateEmail } from '@/utils/formUtils';
import { analytics, ANALYTICS_EVENTS } from '@/utils/analytics';
import { captureBreadcrumb, captureException } from '@/utils/sentry';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toAuthErrorMessage, toUserMessage } from '@/utils/toUserMessage';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // Phase 1: email
  const [email, setEmail] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  // Phase 2: code + new password
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Synchronous in-flight guards. setLoading(true) is async (state batched),
  // so a fast double-tap can fire two requests before React disables the
  // button. These refs flip synchronously on the first invocation. Same
  // pattern as sign-up and verify.
  const sendInFlightRef = useRef(false);
  const resetInFlightRef = useRef(false);

  const onSendCode = async () => {
    if (sendInFlightRef.current) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setSendError('Enter the email you use to sign in.');
      return;
    }
    const emailCheck = validateEmail(trimmed);
    if (!emailCheck.valid) {
      setSendError(emailCheck.error || 'Please enter a valid email address.');
      return;
    }
    sendInFlightRef.current = true;
    setSendLoading(true);
    setSendError(null);
    captureBreadcrumb('Password reset code request started', 'auth.password_reset', {
      has_email: true,
    });
    try {
      await User.requestPasswordReset(trimmed);
      captureBreadcrumb('Password reset code request completed', 'auth.password_reset', {
        result: 'code-sent',
      });
      analytics.track(ANALYTICS_EVENTS.PASSWORD_RESET_CODE_REQUESTED, {
        result: 'code-sent',
      });
      setCodeSent(true);
    } catch (e: any) {
      // Privacy: don't reveal whether the email is registered — treat any
      // server-reached response (404, 500, etc.) as a successful "code sent"
      // so the user can't probe for valid accounts.
      // Reliability: but if the request never reached the server at all
      // (transport-level failure), surface that so the user isn't stranded
      // waiting for a code that was never even attempted to be sent.
      const errMsg = String(e?.message || '');
      const isTransportFailure =
        e?.isNetworkError === true ||
        errMsg.startsWith('Cannot connect to server') ||
        errMsg.includes('Network request failed') ||
        errMsg.includes('Request timeout') ||
        errMsg.includes('fetch');
      if (isTransportFailure) {
        captureBreadcrumb(
          'Password reset code request failed',
          'auth.password_reset',
          {
            result: 'transport-failure',
          },
          'warning'
        );
        captureException(e instanceof Error ? e : new Error(String(e)), {
          tags: { context: 'password_reset_code_request' },
        });
        setSendError(
          errMsg.startsWith('Cannot connect to server')
            ? toAuthErrorMessage(e)
            : 'Could not reach the server to send your reset code. Please check your connection and try again.'
        );
      } else {
        captureBreadcrumb('Password reset code request completed', 'auth.password_reset', {
          result: 'privacy-preserved',
        });
        analytics.track(ANALYTICS_EVENTS.PASSWORD_RESET_CODE_REQUESTED, {
          result: 'privacy-preserved',
        });
        setCodeSent(true);
      }
    } finally {
      setSendLoading(false);
      sendInFlightRef.current = false;
    }
  };

  const onResetPassword = async () => {
    if (resetInFlightRef.current) return;
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
      setResetError('Enter the 6-digit code from your email.');
      return;
    }
    if (password.length < 8) {
      setResetError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    resetInFlightRef.current = true;
    setResetLoading(true);
    setResetError(null);
    captureBreadcrumb('Password reset submitted', 'auth.password_reset', {
      code_length: trimmedCode.length,
    });
    try {
      await User.resetPassword(email.trim(), trimmedCode, password);
      captureBreadcrumb('Password reset succeeded', 'auth.password_reset');
      analytics.track(ANALYTICS_EVENTS.PASSWORD_RESET_COMPLETED, {
        source: 'forgot-password',
      });
      setDone(true);
    } catch (e: any) {
      captureBreadcrumb(
        'Password reset failed',
        'auth.password_reset',
        {
          code_length: trimmedCode.length,
        },
        'warning'
      );
      captureException(e instanceof Error ? e : new Error(String(e)), {
        tags: { context: 'password_reset_submit' },
      });
      setResetError(toUserMessage(e, 'Invalid or expired code. Please try again.'));
    } finally {
      setResetLoading(false);
      resetInFlightRef.current = false;
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={['top']}
    >
      <Stack.Screen
        options={{
          title: 'Forgot Password',
          headerLeft: () => (
            <Pressable
              onPress={() => {
                safeGoBack(router);
              }}
              style={{ paddingLeft: 8 }}
            >
              <MaterialIcons name="chevron-left" size={24} color={palette.tint} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
        <View
          style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border }]}
        >
          {done ? (
            // Success state
            <>
              <MaterialIcons
                name="check-circle"
                size={48}
                color="#10B981"
                style={{ alignSelf: 'center' }}
              />
              <Text style={[styles.title, { color: palette.text, textAlign: 'center' }]}>
                Password updated!
              </Text>
              <Text style={[styles.subtitle, { color: palette.mutedText, textAlign: 'center' }]}>
                You can now sign in with your new password.
              </Text>
              {/* eslint-disable-next-line react-native/no-raw-text */}
              <Button onPress={() => void router.replace('/sign-in')}>Sign in</Button>
            </>
          ) : (
            // All fields on one screen
            <>
              <Text style={[styles.title, { color: palette.text }]}>Reset your password</Text>
              <Text style={[styles.subtitle, { color: palette.mutedText }]}>
                Enter your email and we'll send a 6-digit code to reset your password.
              </Text>

              {sendError ? (
                <Text style={[styles.error, { color: palette.destructive }]}>{sendError}</Text>
              ) : null}
              {resetError ? (
                <Text style={[styles.error, { color: palette.destructive }]}>{resetError}</Text>
              ) : null}

              <Input
                placeholder="name@school.edu"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!codeSent}
                placeholderTextColor={palette.mutedText}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    color: palette.text,
                    opacity: codeSent ? 0.5 : 1,
                  },
                ]}
              />

              {!codeSent ? (
                <Button onPress={onSendCode} disabled={sendLoading}>
                  {sendLoading ? <ActivityIndicator color="white" /> : 'Send reset code'}
                </Button>
              ) : (
                <Text
                  style={[
                    styles.subtitle,
                    { color: '#10B981', fontWeight: '600', textAlign: 'center' },
                  ]}
                >
                  Code sent to {email.trim()}
                </Text>
              )}

              <Input
                placeholder="Enter 6-digit code"
                value={code}
                onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={codeSent}
                placeholderTextColor={palette.mutedText}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    color: palette.text,
                    opacity: codeSent ? 1 : 0.4,
                  },
                ]}
              />

              <PasswordInput
                placeholder="New password (min 8 characters)"
                value={password}
                onChangeText={setPassword}
                editable={codeSent}
                placeholderTextColor={palette.mutedText}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    color: palette.text,
                    opacity: codeSent ? 1 : 0.4,
                  },
                ]}
              />

              <PasswordInput
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={codeSent}
                placeholderTextColor={palette.mutedText}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    color: palette.text,
                    opacity: codeSent ? 1 : 0.4,
                  },
                ]}
              />

              <Button
                onPress={codeSent ? onResetPassword : onSendCode}
                disabled={codeSent ? resetLoading : sendLoading}
              >
                {(codeSent ? resetLoading : sendLoading) ? (
                  <ActivityIndicator color="white" />
                ) : codeSent ? (
                  'Update password'
                ) : (
                  'Send reset code'
                )}
              </Button>

              {codeSent ? (
                <Pressable
                  onPress={() => {
                    setCodeSent(false);
                    setCode('');
                    setPassword('');
                    setConfirmPassword('');
                    setResetError(null);
                    setSendError(null);
                  }}
                  style={styles.linkRow}
                >
                  <Text style={[styles.link, { color: palette.tint }]}>Wrong email? Change it</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        {!done && (
          <Pressable style={styles.secondary} onPress={() => void router.replace('/sign-in')}>
            <Text style={[styles.secondaryText, { color: palette.tint }]}>Back to sign in</Text>
          </Pressable>
        )}
      </KeyboardAwareScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
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
  input: {
    marginTop: 4,
  },
  linkRow: {
    alignItems: 'center',
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
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
