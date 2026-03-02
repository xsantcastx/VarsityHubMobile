import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AppGuideScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'App Guide', headerShown: true, headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingRight: 8 }}>
              <Ionicons name="chevron-back" size={28} color="#007AFF" />
            </Pressable>
          ) }} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>App Guide</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
        View the in-app VarsityHub guide for walkthroughs and best practices.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: {},
});

