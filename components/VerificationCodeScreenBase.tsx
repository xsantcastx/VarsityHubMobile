import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack } from 'expo-router';
import { ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { type VerificationGateState } from '@/hooks/useVerificationGate';
import { useColorScheme } from '@/hooks/useColorScheme';

export function VerificationCodeScreenBase({
  subtitle,
  gate,
  screenError,
  screenInfo,
  isVerified,
  onVerify,
  onResend,
  onContinue,
  useKeyboardAwareScroll = false,
  showBackButton = false,
  onBackPress,
  devCode,
  backLinkLabel,
  onBackLinkPress,
  postFooterContent,
  verifiedHintText,
}: {
  subtitle: ReactNode;
  gate: VerificationGateState;
  screenError: string | null;
  screenInfo: string | null;
  isVerified: boolean;
  onVerify: () => Promise<void>;
  onResend: () => Promise<void>;
  onContinue: () => Promise<void>;
  useKeyboardAwareScroll?: boolean;
  showBackButton?: boolean;
  onBackPress?: () => void;
  devCode?: string | null;
  backLinkLabel?: string;
  onBackLinkPress?: () => void;
  postFooterContent?: ReactNode;
  verifiedHintText?: string;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const content = (
    <>
      {showBackButton && onBackPress ? (
        <Pressable onPress={onBackPress} style={styles.backButton} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
      ) : null}

      <View style={styles.iconContainer}>
        <MaterialIcons
          name="mail-outline"
          size={64}
          color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'}
        />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>Check Your Email</Text>
      <Text style={[styles.subtitle, { color: theme.mutedText }]}>{subtitle}</Text>

      {screenError || gate.error ? <Text style={styles.error}>{screenError || gate.error}</Text> : null}
      {screenInfo || gate.info ? <Text style={styles.info}>{screenInfo || gate.info}</Text> : null}

      {devCode ? (
        <View style={styles.devCodeContainer}>
          <MaterialIcons name="bug-report" size={16} color="#059669" />
          <Text style={styles.devCodeText}>Dev Code: {devCode}</Text>
        </View>
      ) : null}

      <View style={styles.codeSection}>
        <Text style={[styles.label, { color: theme.text }]}>Verification Code</Text>
        <Input
          placeholder="Enter 6-digit code"
          value={gate.code}
          onChangeText={(value: string) => {
            const cleaned = value.replace(/[^0-9]/g, '');
            gate.setCode(cleaned);
            if (cleaned.length === 6) {
              setTimeout(() => {
                Keyboard.dismiss();
                if (!gate.loading && !isVerified) {
                  void onVerify();
                }
              }, 150);
            }
          }}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (gate.code.trim().length >= 6 && !gate.loading && !isVerified) void onVerify();
          }}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.codeInput}
        />
      </View>

      {isVerified ? (
        <Button onPress={onContinue} style={styles.verifyButton}>
          <Text style={styles.continueText}>Continue to App</Text>
        </Button>
      ) : (
        <Button
          onPress={onVerify}
          disabled={gate.loading || gate.code.trim().length < 6}
          style={styles.verifyButton}
        >
          {gate.loading ? <ActivityIndicator color="#fff" /> : 'Verify Email'}
        </Button>
      )}

      {!isVerified ? (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.mutedText }]}>Didn't receive the code?</Text>
          <Pressable onPress={onResend} disabled={gate.loading || gate.resendCooldown > 0}>
            <Text
              style={[
                styles.linkText,
                { color: theme.tint },
                (gate.loading || gate.resendCooldown > 0) && styles.linkTextDisabled,
              ]}
            >
              {gate.resendCooldown > 0 ? `Resend in ${gate.resendCooldown}s` : 'Resend Code'}
            </Text>
          </Pressable>
          {postFooterContent}
        </View>
      ) : null}

      {!isVerified && backLinkLabel && onBackLinkPress ? (
        <Pressable style={styles.skipButton} onPress={onBackLinkPress}>
          <Text style={[styles.skipText, { color: theme.mutedText }]}>{backLinkLabel}</Text>
        </Pressable>
      ) : null}

      {isVerified && verifiedHintText ? (
        <Text style={[styles.autoRedirectText, { color: theme.mutedText }]}>{verifiedHintText}</Text>
      ) : null}
    </>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Verify Your Account',
          headerShown: false,
        }}
      />
      {useKeyboardAwareScroll ? (
        <KeyboardAwareScreen contentContainerStyle={styles.scrollContent}>{content}</KeyboardAwareScreen>
      ) : (
        <View style={styles.centerContent}>{content}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  centerContent: { flex: 1, justifyContent: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
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
  continueText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { alignItems: 'center', marginTop: 8, gap: 8 },
  footerText: { fontSize: 14 },
  linkText: { fontWeight: '700', fontSize: 14 },
  linkTextDisabled: { opacity: 0.5 },
  skipButton: { marginTop: 20, alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 14 },
  error: { color: '#DC2626', marginBottom: 12, textAlign: 'center', fontSize: 14 },
  info: { color: '#059669', marginBottom: 12, textAlign: 'center', fontSize: 14 },
  devCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  devCodeText: { color: '#059669', fontSize: 14, fontWeight: '600' },
  autoRedirectText: { fontSize: 14, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});
