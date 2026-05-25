import type { ReactNode } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type InviteScreenShellProps = {
  title: string;
  backgroundColor: string;
  textColor: string;
  onBack: () => void;
  subtitle?: ReactNode;
  children: ReactNode;
};

export function InviteScreenShell({
  title,
  backgroundColor,
  textColor,
  onBack,
  subtitle,
  children,
}: InviteScreenShellProps) {
  return (
    <SafeAreaView
      style={[inviteScreenSharedStyles.container, { backgroundColor }]}
      edges={['top', 'bottom']}
    >
      <Stack.Screen
        options={{
          title,
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={onBack} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
            </Pressable>
          ),
        }}
      />
      <Text style={[inviteScreenSharedStyles.title, { color: textColor }]}>{title}</Text>
      {subtitle}
      {children}
    </SafeAreaView>
  );
}

export const inviteScreenSharedStyles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { marginBottom: 12 },
  loading: { paddingVertical: 16 },
  error: { color: '#b91c1c' },
  muted: {},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actions: { flexDirection: 'row', gap: 8 },
  name: { fontWeight: '700' },
});
