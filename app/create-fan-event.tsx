import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreateFanEventScreen() {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <Stack.Screen options={{ title: 'Create Fan Event' }} />
      <Text style={styles.title}>Create Fan Event</Text>
      <Text style={styles.subtitle}>Mobile implementation coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#6b7280' },
});

