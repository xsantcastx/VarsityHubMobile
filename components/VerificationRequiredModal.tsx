import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface VerificationRequiredModalProps {
  visible: boolean;
  email?: string | null;
  code: string;
  loading: boolean;
  error?: string | null;
  info?: string | null;
  resendCooldown: number;
  onChangeCode: (value: string) => void;
  onVerify: () => void | Promise<void>;
  onResend: () => void | Promise<void>;
  onCancel: () => void;
}

export function VerificationRequiredModal({
  visible,
  email,
  code,
  loading,
  error,
  info,
  resendCooldown,
  onChangeCode,
  onVerify,
  onResend,
  onCancel,
}: VerificationRequiredModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View
          style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: colorScheme === 'dark' ? 'rgba(96,165,250,0.16)' : '#DBEAFE' },
            ]}
          >
            <MaterialIcons
              name="mark-email-read"
              size={28}
              color={colorScheme === 'dark' ? '#93C5FD' : '#2563EB'}
            />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Verify Your Email</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            Enter the 6-digit code we sent to {email || 'your email address'} to continue.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}

          <Input
            placeholder="Enter 6-digit code"
            value={code}
            onChangeText={(value: string) => {
              const next = value.replace(/[^0-9]/g, '').slice(0, 6);
              onChangeCode(next);
              // Patient auto-submit: verify when 6 digits are in, but never
              // dismiss the keyboard first — if the code is wrong the user
              // keeps their input and can correct it immediately.
              if (next.length === 6 && !loading) {
                setTimeout(() => {
                  void onVerify();
                }, 150);
              }
            }}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (code.trim().length === 6 && !loading) void onVerify();
            }}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.codeInput}
          />

          <Button
            onPress={() => void onVerify()}
            disabled={loading || code.trim().length !== 6}
            style={styles.primaryButton}
          >
            {loading ? <ActivityIndicator color="#fff" /> : 'Verify and Continue'}
          </Button>

          <View style={styles.actionsRow}>
            <Pressable onPress={() => void onResend()} disabled={loading || resendCooldown > 0}>
              <Text
                style={[
                  styles.linkText,
                  { color: colors.tint },
                  (loading || resendCooldown > 0) && styles.linkTextDisabled,
                ]}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </Text>
            </Pressable>

            <Pressable onPress={onCancel} disabled={loading}>
              <Text
                style={[
                  styles.cancelText,
                  { color: colors.mutedText },
                  loading && styles.linkTextDisabled,
                ]}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 8px 18px rgba(0, 0, 0, 0.16)' }
      : {
          shadowColor: '#000',
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        }),
    elevation: 8,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  codeInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 14,
  },
  primaryButton: {
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  linkTextDisabled: {
    opacity: 0.45,
  },
  error: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 12,
  },
  info: {
    color: '#059669',
    fontSize: 14,
    marginBottom: 12,
  },
});
