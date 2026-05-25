import type { ReactNode } from 'react';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';

type ColorSchemeValue = 'light' | 'dark' | null | undefined;

type SettingsFormScreenProps = {
  title: string;
  headerTitle?: string;
  colorScheme: ColorSchemeValue;
  children: ReactNode;
};

export function SettingsFormScreen({
  title,
  headerTitle,
  colorScheme,
  children,
}: SettingsFormScreenProps) {
  const resolvedColorScheme = colorScheme ?? 'light';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors[resolvedColorScheme].background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title,
          headerBackTitle: 'Back',
          headerShown: true,
        }}
      />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.title, { color: Colors[resolvedColorScheme].text }]}>
          {headerTitle ?? title}
        </Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export const settingsFormSharedStyles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});

const styles = settingsFormSharedStyles;
