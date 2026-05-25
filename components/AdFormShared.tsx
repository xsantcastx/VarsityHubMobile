import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type AdFormLoadingProps = {
  title: string;
  message: string;
  textColor: string;
};

type AdFormHeaderProps = {
  title: string;
  subtitle: string;
  textColor: string;
  mutedTextColor: string;
};

type AdFormPrimaryCtaProps = {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function AdFormLoading({ title, message, textColor }: AdFormLoadingProps) {
  return (
    <View style={adFormSharedStyles.loadingContainer}>
      <Stack.Screen options={{ title, headerShown: true }} />
      <ActivityIndicator size="large" />
      <Text style={[adFormSharedStyles.loadingText, { color: textColor }]}>{message}</Text>
    </View>
  );
}

export function AdFormHeader({
  title,
  subtitle,
  textColor,
  mutedTextColor,
}: AdFormHeaderProps) {
  return (
    <View style={adFormSharedStyles.header}>
      <Text style={[adFormSharedStyles.title, { color: textColor }]}>{title}</Text>
      <Text style={[adFormSharedStyles.subtitle, { color: mutedTextColor }]}>{subtitle}</Text>
    </View>
  );
}

export function AdFormPrimaryCta({
  label,
  disabled = false,
  loading = false,
  onPress,
}: AdFormPrimaryCtaProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[adFormSharedStyles.cta, disabled && adFormSharedStyles.ctaDisabled]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={adFormSharedStyles.ctaText}>{label}</Text>}
    </Pressable>
  );
}

export const adFormSharedStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 20,
  },
  label: {
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  helperText: {
    fontSize: 13,
    marginTop: -4,
    marginBottom: 4,
  },
  muted: {
    fontSize: 13,
    marginTop: -4,
    marginBottom: 4,
    lineHeight: 18,
  },
  cta: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
