import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function ArchiveSeasonsScreen() {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'Archive Seasons' }} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Archive Seasons</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>Season archiving is available from the VarsityHub web dashboard.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: {},
});
