import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function MyTeamScreen() {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'My Team' }} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>My Team</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>Manage your team roster and staff from the VarsityHub web dashboard.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: {},
});
