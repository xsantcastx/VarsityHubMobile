import { useThemedStyles } from '@/hooks/useThemedStyles';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function CoreValuesScreen() {
  const { colors } = useThemedStyles();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Core Values' }} />
      <Text style={[styles.title, { color: colors.text }]}>Core Values</Text>
      <Text style={[styles.subtitle, { color: colors.mutedText }]}>Mobile implementation coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16 },
});

