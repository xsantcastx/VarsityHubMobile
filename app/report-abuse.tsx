import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReportAbuseScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Report Abuse' }} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Report Abuse</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>Mobile implementation coming soon.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: {},
});

