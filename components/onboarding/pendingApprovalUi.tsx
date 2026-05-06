import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function PendingApprovalShell({
  isDark,
  status,
  heading,
  subheading,
  children,
}: {
  isDark: boolean;
  status: 'pending' | 'approved' | 'rejected';
  heading: string;
  subheading: string;
  children: ReactNode;
}) {
  const iconBackground =
    status === 'rejected'
      ? isDark
        ? 'rgba(220,38,38,0.15)'
        : '#FEE2E2'
      : status === 'approved'
        ? isDark
          ? 'rgba(22,163,74,0.15)'
          : '#D1FAE5'
        : isDark
          ? 'rgba(218,165,32,0.15)'
          : '#FEF9C3';

  return (
    <>
      <View style={styles.logoRow}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={{ width: 32, height: 32 }}
          contentFit="contain"
        />
        <Text style={[styles.logoText, { color: isDark ? '#F9FAFB' : '#111827' }]}>VarsityHub</Text>
      </View>

      <View style={[styles.iconCircle, { backgroundColor: iconBackground }]}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={{ width: 56, height: 56 }}
          contentFit="contain"
        />
      </View>

      <Text style={[styles.heading, { color: isDark ? '#F9FAFB' : '#111827' }]}>{heading}</Text>
      <Text style={[styles.subheading, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{subheading}</Text>
      {children}
    </>
  );
}

export function ReasonCard({
  isDark,
  label = 'Reason:',
  body,
  footer,
}: {
  isDark: boolean;
  label?: string;
  body: string;
  footer?: string | null;
}) {
  return (
    <View
      style={[
        styles.reasonCard,
        {
          backgroundColor: isDark ? 'rgba(220,38,38,0.1)' : '#FEF2F2',
          borderColor: isDark ? '#7F1D1D' : '#FECACA',
        },
      ]}
    >
      <Text style={[styles.reasonLabel, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>{label}</Text>
      <Text style={[styles.reasonText, { color: isDark ? '#F9FAFB' : '#111827' }]}>{body}</Text>
      {footer ? (
        <Text
          style={[
            styles.reasonText,
            { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 8, fontSize: 13 },
          ]}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable style={[styles.primaryButton, disabled && { opacity: 0.6 }, style]} onPress={onPress} disabled={disabled}>
      {icon}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  color,
  borderColor,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  color: string;
  borderColor: string;
  disabled?: boolean;
  style?: any;
}) {
  return (
    <Pressable
      style={[styles.secondaryButton, { borderColor }, disabled && { opacity: 0.6 }, style]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.secondaryButtonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function PollingStatus({ isDark }: { isDark: boolean }) {
  return (
    <View style={styles.pollingRow}>
      <ActivityIndicator size="small" color={isDark ? '#6B7280' : '#9CA3AF'} />
      <Text style={[styles.pollingText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>Checking status...</Text>
    </View>
  );
}

export function SupportText({ isDark, children }: { isDark: boolean; children: ReactNode }) {
  return <Text style={[styles.supportText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>{children}</Text>;
}

export function FanFallbackActions({
  isDark,
  onProceedAsFan,
  onLogout,
  checking = false,
  supportText = 'Questions? Contact support@varsityhub.app',
}: {
  isDark: boolean;
  onProceedAsFan: () => void;
  onLogout: () => void;
  checking?: boolean;
  supportText?: string;
}) {
  return (
    <>
      <PrimaryButton label="Continue as Fan" onPress={onProceedAsFan} style={{ marginBottom: 12 }} />
      <SecondaryButton
        label="Log Out"
        onPress={onLogout}
        borderColor={isDark ? '#374151' : '#D1D5DB'}
        color={isDark ? '#9CA3AF' : '#6B7280'}
      />
      {checking ? <PollingStatus isDark={isDark} /> : null}
      <SupportText isDark={isDark}>{supportText}</SupportText>
    </>
  );
}

export function CoachSetupActions({
  onContinueSetup,
  onCreateTeam,
  disabled,
  createTeamLabel = 'Create Your First Team',
  primaryIcon,
}: {
  onContinueSetup: () => void;
  onCreateTeam?: () => void;
  disabled?: boolean;
  createTeamLabel?: string;
  primaryIcon?: ReactNode;
}) {
  return (
    <>
      <PrimaryButton
        label="Continue Coach Setup"
        onPress={onContinueSetup}
        disabled={disabled}
        style={{ backgroundColor: '#1B3A6B', marginTop: 24 }}
        icon={primaryIcon}
      />
      {onCreateTeam ? (
        <SecondaryButton
          label={createTeamLabel}
          onPress={onCreateTeam}
          disabled={disabled}
          borderColor="#1B3A6B"
          color="#1B3A6B"
          style={{ marginTop: 0 }}
        />
      ) : null}
    </>
  );
}

export function InfoCardRow({
  isDark,
  icon,
  label,
  value,
}: {
  isDark: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={18} color={isDark ? '#60A5FA' : '#2563EB'} />
      <Text style={[styles.infoLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: isDark ? '#F9FAFB' : '#111827' }]}>{value}</Text>
    </View>
  );
}

export const pendingApprovalStyles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40 },
  logoText: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heading: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
  subheading: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32, paddingHorizontal: 12 },
  infoCard: {
    width: '100%',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 13, fontWeight: '600' },
  infoValue: { fontSize: 13, fontWeight: '700', flex: 1 },
  primaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B3A6B',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
  pollingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  pollingText: { fontSize: 12 },
  supportText: { fontSize: 12, textAlign: 'center', marginTop: 'auto', marginBottom: 16 },
  reasonCard: {
    width: '100%',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 4,
  },
  reasonLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonText: { fontSize: 14, lineHeight: 20 },
});

const styles = pendingApprovalStyles;
