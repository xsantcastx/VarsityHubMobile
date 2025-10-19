import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PublicEventScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Public Event' }} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Public Event</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>Mobile implementation coming soon.</Text>
      {params?.id ? <Text style={{ color: Colors[colorScheme].text }}>Event ID: {params.id}</Text> : null}
      <Text style={[styles.params, { color: Colors[colorScheme].text }]}>{JSON.stringify(params, null, 2)}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { marginBottom: 12 },
  params: { fontFamily: 'monospace' },
});

