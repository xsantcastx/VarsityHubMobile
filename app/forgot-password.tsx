import { User } from '@/api/entities';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { validateEmail } from '@/utils/formUtils';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
    useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { t } = useAppTranslation();

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

  const onSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setSendError(t('auth.forgotPassword.errors.enterEmail'));
      return;
    }
    const emailCheck = validateEmail(trimmed);
    if (!emailCheck.valid) {
      setSendError(t('auth.forgotPassword.errors.invalidEmail'));
      return;
    }
    setSendLoading(true);
    setSendError(null);
    try {
      await User.requestPasswordReset(trimmed);
      setCodeSent(true);
    } catch {
      // Never reveal whether the email exists — treat server errors as success
      setCodeSent(true);
    } finally {
      setSendLoading(false);
    }
  };

  const onResetPassword = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
      setResetError(t('auth.forgotPassword.errors.invalidCode'));
      return;
    }
    if (password.length < 8) {
      setResetError(t('auth.forgotPassword.errors.passwordMin'));
      return;
    }
    if (password !== confirmPassword) {
      setResetError(t('auth.forgotPassword.errors.passwordsDoNotMatch'));
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      await User.resetPassword(email.trim(), trimmedCode, password);
      setDone(true);
    } catch (e: any) {
      setResetError(e?.message || t('auth.forgotPassword.errors.invalidOrExpiredCode'));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <Stack.Screen options={{
        title: t('auth.forgotPassword.meta.title'),
        headerLeft: () => (
          <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingLeft: 8 }}>
            <MaterialIcons name="chevron-left" size={24} color={palette.tint} />
          </Pressable>
        ),
      }} />
      <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border }]}>

          {done ? (
            // Success state
            <>
              <MaterialIcons name="check-circle" size={48} color="#10B981" style={{ alignSelf: 'center' }} />
              <Text style={[styles.title, { color: palette.text, textAlign: 'center' }]}>{t('auth.forgotPassword.success.title')}</Text>
              <Text style={[styles.subtitle, { color: palette.mutedText, textAlign: 'center' }]}>
                {t('auth.forgotPassword.success.subtitle')}
              </Text>
              {/* eslint-disable-next-line react-native/no-raw-text */}
              <Button onPress={() => void router.replace('/sign-in')}>
                {t('auth.forgotPassword.success.signIn')}
              </Button>
            </>
          ) : (
            // All fields on one screen
            <>
              <Text style={[styles.title, { color: palette.text }]}>{t('auth.forgotPassword.form.title')}</Text>
              <Text style={[styles.subtitle, { color: palette.mutedText }]}>
                {t('auth.forgotPassword.form.subtitle')}
              </Text>

              {sendError ? <Text style={[styles.error, { color: palette.destructive }]}>{sendError}</Text> : null}
              {resetError ? <Text style={[styles.error, { color: palette.destructive }]}>{resetError}</Text> : null}

              <Input
                placeholder={t('common.placeholders.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!codeSent}
                placeholderTextColor={palette.mutedText}
                style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text, opacity: codeSent ? 0.5 : 1 }]}
              />

              {!codeSent ? (
                <Button onPress={onSendCode} disabled={sendLoading}>
                  {sendLoading ? <ActivityIndicator color="white" /> : t('auth.forgotPassword.actions.sendResetCode')}
                </Button>
              ) : (
                <Text style={[styles.subtitle, { color: '#10B981', fontWeight: '600', textAlign: 'center' }]}>
                  {t('auth.forgotPassword.form.codeSent', { email: email.trim() })}
                </Text>
              )}

              <Input
                placeholder={t('auth.forgotPassword.fields.codePlaceholder')}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={codeSent}
                placeholderTextColor={palette.mutedText}
                style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text, opacity: codeSent ? 1 : 0.4 }]}
              />

              <Input
                placeholder={t('auth.forgotPassword.fields.newPasswordPlaceholder')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={codeSent}
                placeholderTextColor={palette.mutedText}
                style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text, opacity: codeSent ? 1 : 0.4 }]}
              />

              <Input
                placeholder={t('auth.forgotPassword.fields.confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={codeSent}
                placeholderTextColor={palette.mutedText}
                style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text, opacity: codeSent ? 1 : 0.4 }]}
              />

              <Button onPress={codeSent ? onResetPassword : onSendCode} disabled={codeSent ? resetLoading : sendLoading}>
                {(codeSent ? resetLoading : sendLoading)
                  ? <ActivityIndicator color="white" />
                  : codeSent ? t('auth.forgotPassword.actions.updatePassword') : t('auth.forgotPassword.actions.sendResetCode')}
              </Button>

              {codeSent ? (
                <Pressable onPress={() => { setCodeSent(false); setCode(''); setPassword(''); setConfirmPassword(''); setResetError(null); setSendError(null); }} style={styles.linkRow}>
                  <Text style={[styles.link, { color: palette.tint }]}>{t('auth.forgotPassword.actions.wrongEmail')}</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        {!done && (
          <Pressable style={styles.secondary} onPress={() => void router.replace('/sign-in')}>
            <Text style={[styles.secondaryText, { color: palette.tint }]}>{t('auth.forgotPassword.actions.backToSignIn')}</Text>
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
