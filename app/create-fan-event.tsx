import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreateFanEventScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16), backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'Create Fan Event' }} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Create Fan Event</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
        Fan events can be created from the VarsityHub web dashboard so you can invite supporters with full scheduling tools.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: {},
});

