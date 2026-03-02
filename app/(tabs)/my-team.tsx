import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function MyTeamScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'My Team', headerShown: true, headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingRight: 8 }}>
              <Ionicons name="chevron-back" size={28} color="#007AFF" />
            </Pressable>
          ) }} />
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
