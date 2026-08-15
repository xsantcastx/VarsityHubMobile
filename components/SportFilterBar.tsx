import { Colors } from '@/constants/Colors';
import { SPORT_EMOJI, SPORT_OPTIONS } from '@/constants/sports';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  /** Canonical sport slugs present on the map right now. */
  sports: string[];
  /** Currently selected slug, or null for "all". */
  selected: string | null;
  onSelect: (slug: string | null) => void;
};

const LABEL_BY_SLUG: Record<string, string> = SPORT_OPTIONS.reduce(
  (acc, s) => {
    acc[s.slug] = s.label;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * A single sport-filter button that opens a picker of the sports currently on
 * the map (owner ask 2026-08-06: "the sport emojis should be their own button —
 * one button that lets you filter which sport"). Replaced the older strip of
 * separate emoji chips. Renders nothing unless at least two sports are present —
 * a filter with one option is just noise.
 */
export default function SportFilterBar({ sports, selected, onSelect }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const [open, setOpen] = useState(false);

  // Keep options in canonical taxonomy order, not fetch order, so it's stable.
  const ordered = SPORT_OPTIONS.filter(s => sports.includes(s.slug)).map(s => s.slug);
  if (ordered.length < 2) return null;

  const selectedLabel = selected ? (LABEL_BY_SLUG[selected] ?? selected) : 'All Sports';
  const selectedEmoji = selected ? (SPORT_EMOJI[selected] ?? '🏅') : '🏟️';

  const choose = (slug: string | null) => {
    onSelect(slug);
    setOpen(false);
  };

  const OptionRow = ({ slug }: { slug: string | null }) => {
    const active = selected === slug;
    const label = slug ? (LABEL_BY_SLUG[slug] ?? slug) : 'All Sports';
    const emoji = slug ? (SPORT_EMOJI[slug] ?? '🏅') : '🏟️';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Filter by ${label}`}
        accessibilityState={{ selected: active }}
        onPress={() => choose(slug)}
        style={[styles.optionRow, active ? { backgroundColor: theme.tint + '22' } : null]}
      >
        <Text style={styles.optionEmoji}>{emoji}</Text>
        <Text style={[styles.optionLabel, { color: theme.text }]}>{label}</Text>
        {active ? <Ionicons name="checkmark" size={18} color={theme.tint} /> : null}
      </Pressable>
    );
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Filter by sport. Current: ${selectedLabel}`}
        onPress={() => setOpen(true)}
        style={[styles.button, { backgroundColor: theme.background, borderColor: theme.border }]}
      >
        <Text style={styles.buttonEmoji}>{selectedEmoji}</Text>
        <Text style={[styles.buttonLabel, { color: theme.text }]} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.mutedText} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={e => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: theme.mutedText }]}>Filter by sport</Text>
            <OptionRow slug={null} />
            {ordered.map(slug => (
              <OptionRow key={slug} slug={slug} />
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    maxWidth: 200,
    // Subtle lift so the button reads against the map without a heavy card.
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  buttonEmoji: { fontSize: 16, lineHeight: 20 },
  buttonLabel: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: 8,
    // Elevated sheet.
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionEmoji: { fontSize: 20, lineHeight: 24, width: 26, textAlign: 'center' },
  optionLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
});
