import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

interface ZipCodeMapPreviewProps {
  zipCode: string;
  title?: string;
  subtitle?: string;
  radiusKm?: number;
  showCircle?: boolean;
}

export function ZipCodeMapPreview({ zipCode, title = 'Your Area' }: ZipCodeMapPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  if (!zipCode.trim()) return null;

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].surface }]}>
      <MaterialIcons name="map" size={40} color={Colors[colorScheme].mutedText} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{title}</Text>
      <Text style={[styles.desc, { color: Colors[colorScheme].mutedText }]}>
        Location preview for ZIP {zipCode}
      </Text>
      <Text style={[styles.note, { color: Colors[colorScheme].mutedText }]}>
        Interactive maps are available on the mobile app
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  desc: { fontSize: 13, textAlign: 'center' },
  note: { fontSize: 11, fontStyle: 'italic', marginTop: 2 },
});
