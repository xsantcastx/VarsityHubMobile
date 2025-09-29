import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type AppearancePreset = 'classic' | 'sparkle' | 'sporty';

interface Props {
  value?: AppearancePreset;
  onChange: (v: AppearancePreset) => void;
}

export default function AppearancePicker({ value = 'classic', onChange }: Props) {
  const colorScheme = useColorScheme() ?? 'light';

  const presets: { id: AppearancePreset; label: string; color: string }[] = [
    { id: 'classic', label: 'Classic', color: Colors[colorScheme].mutedText },
    { id: 'sparkle', label: 'Sparkle', color: Colors[colorScheme].tint },
    { id: 'sporty', label: 'Sporty', color: '#F59E0B' },
  ];

  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Appearance</Text>
      <View style={styles.row}>
        {presets.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onChange(p.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === p.id }}
            style={[styles.button, value === p.id && { borderColor: p.color, borderWidth: 2 }]}
          >
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <Text style={styles.buttonText}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  swatch: { width: 18, height: 18, borderRadius: 6 },
  buttonText: { fontSize: 13, fontWeight: '600' },
});
