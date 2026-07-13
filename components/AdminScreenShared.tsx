import type { ReactNode } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AdminGuardStateProps = {
  backgroundColor: string;
  textColor: string;
  loading?: boolean;
};

type AdminScreenShellProps = {
  title: string;
  backgroundColor: string;
  onBack: () => void;
  headerRight?: () => ReactNode;
  children: ReactNode;
};

export function AdminGuardState({
  backgroundColor,
  textColor,
  loading = false,
}: AdminGuardStateProps) {
  return (
    <SafeAreaView
      style={[styles.container, styles.centered, { backgroundColor }]}
      edges={['top', 'bottom']}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text style={{ color: textColor, fontSize: 16, fontWeight: '600' }}>
          Admin access required
        </Text>
      )}
    </SafeAreaView>
  );
}

export function AdminScreenShell({
  title,
  backgroundColor,
  onBack,
  headerRight,
  children,
}: AdminScreenShellProps) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title,
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={onBack} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
            </Pressable>
          ),
          headerRight,
        }}
      />
      {children}
    </SafeAreaView>
  );
}

export const adminScreenSharedStyles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  listLoading: { padding: 24, alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 24 },
  error: { padding: 12 },
  elevatedListCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
        }),
    elevation: 1,
  },
  listTitle: {
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 4,
  },
  listMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  centeredError: {
    padding: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
});
