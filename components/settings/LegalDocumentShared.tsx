import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { Colors } from '@/constants/Colors';

type ColorScheme = 'light' | 'dark';

type LegalDocumentScreenProps = {
  title: string;
  colorScheme: ColorScheme;
  children: ReactNode;
};

type LegalSectionCardProps = {
  title: string;
  body: string;
  colorScheme: ColorScheme;
};

export function LegalDocumentScreen({
  title,
  colorScheme,
  children,
}: LegalDocumentScreenProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
      edges={['bottom']}
    >
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function LegalSectionCard({
  title,
  body,
  colorScheme,
}: LegalSectionCardProps) {
  return (
    <View
      style={[
        styles.section,
        { borderColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].card },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
      <Text style={[styles.sectionBody, { color: Colors[colorScheme].mutedText }]}>{body}</Text>
    </View>
  );
}

export const legalDocumentSharedStyles = StyleSheet.create({
  updatedAt: { fontSize: 12, marginBottom: 4 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 16 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
