import { Colors } from '@/constants/Colors';
import { EVENT_LIVE_WINDOW_HOURS, type EventLiveWindowHours } from '@/constants/eventPresentation';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function EventLiveWindowPicker({
  value,
  onChange,
}: {
  value?: EventLiveWindowHours;
  onChange: (hours: EventLiveWindowHours) => void;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.text }]}>Live posting window</Text>
      <View style={styles.row}>
        {EVENT_LIVE_WINDOW_HOURS.map(hours => (
          <Pressable
            key={hours}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === hours }}
            accessibilityLabel={`${hours}-hour live posting window`}
            onPress={() => onChange(hours)}
            style={[
              styles.option,
              {
                borderColor: value === hours ? colors.tint : colors.border,
                backgroundColor: value === hours ? colors.tint : colors.surface,
              },
            ]}
          >
            <Text style={{ color: value === hours ? '#FFFFFF' : colors.text, fontWeight: '600' }}>
              {hours === 5 ? '5-hour event' : '12-hour day'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.help, { color: colors.mutedText }]}>
        {value
          ? `Posting closes ${value} hours after the scheduled start. Fans must be at the venue to unlock posting.`
          : 'Your current posting window is preserved until you choose a new one.'}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  label: { fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1,
    minHeight: 44,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
  },
  help: { fontSize: 13, lineHeight: 18, marginTop: 8 },
});
