import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { StyleSheet, Text, View } from 'react-native';

import type { EventMapProps } from './EventMap.types';

export default function EventMapWebFallback({ events }: EventMapProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const hasCoordinates = events?.some(event => event.latitude && event.longitude);

  return (
    <View style={[styles.container, { borderColor: Colors[colorScheme].border }]}>
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Map Unavailable on Web</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>Open the VarsityHub mobile app to view events on the interactive map.</Text>
      {hasCoordinates && (
        <View style={styles.list}>
          {events.filter(event => event.latitude && event.longitude).map(event => (
            <Text key={event.id} style={[styles.event, { color: Colors[colorScheme].text }]}>• {event.title}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
  event: {
    fontSize: 14,
    marginBottom: 4,
  },
});
