/**
 * Web version of ReachMapPreview - Shows a placeholder message
 * since maps are not supported on web platform
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

interface ReachMapPreviewProps {
  zipCode: string;
  radiusKm?: number;
}

export function ReachMapPreview({ zipCode, radiusKm = 15 }: ReachMapPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const radiusMiles = Math.round(radiusKm * 0.621371); // Convert km to miles

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].surface }]}>
      <View style={styles.content}>
        <Ionicons name="map-outline" size={48} color={Colors[colorScheme].mutedText} />
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
          Map Preview
        </Text>
        <Text style={[styles.description, { color: Colors[colorScheme].mutedText }]}>
          Your ad will reach users within {radiusMiles} miles of ZIP code {zipCode}
        </Text>
        <Text style={[styles.note, { color: Colors[colorScheme].mutedText }]}>
          Interactive maps are available on the mobile app
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  content: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  note: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
