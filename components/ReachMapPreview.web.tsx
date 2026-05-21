/**
 * Web version of ReachMapPreview - Shows a placeholder message
 * since maps are not supported on web platform
 */

import { Colors } from '@/constants/Colors';
import { AD_GEOFENCE_RADIUS_KM } from '@/constants/adGeofencing';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

interface ReachMapPreviewProps {
  zipCode: string;
  radiusKm?: number;
}

export function ReachMapPreview({
  zipCode,
  radiusKm = AD_GEOFENCE_RADIUS_KM,
}: ReachMapPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].surface }]}>
      <View style={styles.content}>
        <MaterialIcons name="map" size={48} color={Colors[colorScheme].mutedText} />
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
          Map Preview
        </Text>
        <Text style={[styles.description, { color: Colors[colorScheme].mutedText }]}>
          Your ad will reach users within {radiusKm} km of ZIP code {zipCode}. Booking stays tied to this ZIP code.
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
