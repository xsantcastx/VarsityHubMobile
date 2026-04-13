import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { captureException } from '@/utils/sentry';

export default function VerifyScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { t } = useAppTranslation();
  const { pendingVerificationEmail, checkAuth, user, markOnboardingCompleteLocally: _markOnboardingCompleteLocally } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const onVerify = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null); setInfo(null);

    const startTime = Date.now();
    const _email = pendingVerificationEmail || user?.email;

    try {
      await User.verifyEmail(code.trim());
      const verifyDuration = Date.now() - startTime;

      captureException(new Error(`[TELEMETRY] Email verified in ${verifyDuration}ms`), {
        tags: { context: 'verify-email-success', duration_ms: String(verifyDuration) },
        extra: { email: _email },
      });

      setInfo(t('auth.verify.info.verified'));
      setCode('');
      setIsVerified(true);

      // After successful verification, let AuthProvider be the single source of truth for routing.
      try {
        await checkAuth();
      } catch (userError) {
        captureException(
          typeof userError === 'string' ? new Error(userError) : (userError as Error),
          { tags: { context: 'verify-email-refresh' } }
        );
        setError(t('auth.verify.errors.profileReloadFailed'));
        redirectTimerRef.current = setTimeout(() => {
          router.replace('/sign-in');
        }, 2000);
      }
    } catch (e: any) {
      const errorDuration = Date.now() - startTime;
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'verify-email-verify', duration_ms: String(errorDuration) },
        extra: { code_length: String(code).length },
      });
      
      // Provide more helpful error messages
      let errorMsg = e?.message || e?.data?.error || t('auth.verify.errors.default');
      const status = e?.status;
      
      if (status === 429) {
        errorMsg = t('auth.verify.errors.tooManyAttempts');
      } else if (status === 400) {
        if (errorMsg.includes('expired')) {
          errorMsg = t('auth.verify.errors.expired');
        } else if (errorMsg.includes('Invalid code')) {
          errorMsg = t('auth.verify.errors.invalidCode');
        } else if (errorMsg.includes('No verification in progress')) {
          errorMsg = t('auth.verify.errors.noVerificationInProgress');
        }
      } else if (status === 401) {
        errorMsg = t('auth.verify.errors.signInAgain');
      } else if (status === 404) {
        errorMsg = t('auth.verify.errors.accountNotFound');
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setLoading(true); setError(null); setInfo(null);

    const startTime = Date.now();
    const _email = pendingVerificationEmail || user?.email;

    try {
      const res: any = await User.requestVerification();
      const resendDuration = Date.now() - startTime;

      captureException(new Error(`[TELEMETRY] Resend requested in ${resendDuration}ms`), {
        tags: { context: 'verify-email-resend-success', duration_ms: String(resendDuration) },
        extra: { sendgrid_ready: res?.dev_verification_code ? 'dev-mode' : 'production' },
      });

      setInfo(t('auth.verify.info.verificationSent'));
      setResendCooldown(60);
    } catch (e: any) {
      const resendDuration = Date.now() - startTime;
      captureException(typeof e === 'string' ? new Error(e) : e, {
        tags: { context: 'verify-email-resend', duration_ms: String(resendDuration) },
        extra: { error_code: e?.data?.error },
      });
      
      let errorMsg = e?.message || e?.data?.error || t('auth.verify.errors.resendDefault');
      const status = e?.status;
      
      // Provide helpful error messages
      if (status === 429) {
        errorMsg = t('auth.verify.errors.resendWait');
        setResendCooldown(60);
      } else if (status === 401) {
        errorMsg = t('auth.verify.errors.resendSignInAgain');
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const onContinue = async () => {
    await checkAuth();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: t('auth.verify.meta.title'),
          headerShown: false,
        }}
      />

      {/* Header Icon */}
      <View style={styles.iconContainer}>
        <MaterialIcons name="mail-outline" size={64} color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} />
      </View>

      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{t('auth.verify.title')}</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
        {t('auth.verify.subtitle', {
          email: pendingVerificationEmail || user?.email || t('auth.verify.fallbackEmail'),
        })}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <View style={styles.codeSection}>
        <Text style={[styles.label, { color: Colors[colorScheme].text }]}>{t('auth.verify.fields.codeLabel')}</Text>
        <Input
          placeholder={t('auth.verify.fields.codePlaceholder')}
          value={code}
          onChangeText={(t: string) => {
            const cleaned = t.replace(/[^0-9]/g, '');
            setCode(cleaned);
            if (cleaned.length === 6) {
              setTimeout(() => Keyboard.dismiss(), 100);
            }
          }}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.codeInput}
        />
      </View>

      {isVerified ? (
        <Button onPress={onContinue} style={styles.verifyButton}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('auth.verify.actions.continueToApp')}</Text>
        </Button>
      ) : (
        <Button
          onPress={onVerify}
          disabled={loading || code.trim().length < 6}
          style={styles.verifyButton}
        >
          {loading ? <ActivityIndicator color="#fff" /> : t('auth.verify.actions.verifyEmail')}
        </Button>
      )}

      {!isVerified && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: Colors[colorScheme].mutedText }]}>{t('auth.verify.actions.didNotReceiveCode')}</Text>
          <Pressable onPress={onResend} disabled={loading || resendCooldown > 0}>
            <Text style={[styles.linkText, { color: Colors[colorScheme].tint }, (loading || resendCooldown > 0) && styles.linkTextDisabled]}>
              {resendCooldown > 0
                ? t('auth.verify.actions.resendIn', { seconds: resendCooldown })
                : t('auth.verify.actions.resendCode')}
            </Text>
          </Pressable>
        </View>
      )}


      {isVerified && (
        <Text style={[styles.autoRedirectText, { color: Colors[colorScheme].mutedText }]}>
          {t('auth.verify.actions.autoContinue')}
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  iconContainer: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  codeSection: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  codeInput: { fontSize: 24, textAlign: 'center', letterSpacing: 8 },
  verifyButton: { marginBottom: 16 },
  footer: { alignItems: 'center', marginTop: 8, gap: 8 },
  footerText: { fontSize: 14 },
  linkText: { fontWeight: '700', fontSize: 14 },
  linkTextDisabled: { opacity: 0.5 },
  error: { color: '#DC2626', marginBottom: 12, textAlign: 'center', fontSize: 14 },
  info: { color: '#059669', marginBottom: 12, textAlign: 'center', fontSize: 14 },
  autoRedirectText: { fontSize: 14, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});
