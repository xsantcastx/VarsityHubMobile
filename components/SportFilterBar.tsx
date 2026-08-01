import { Colors } from '@/constants/Colors';
import { SPORT_EMOJI, SPORT_OPTIONS } from '@/constants/sports';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

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
 * A compact, discreet strip of sport emoji chips that filters the map by sport.
 * Renders nothing unless at least two sports are present — a filter with one
 * option is just noise. Tapping the active chip clears the filter.
 */
export default function SportFilterBar({ sports, selected, onSelect }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  // Keep chips in canonical taxonomy order, not fetch order, so the row is stable.
  const ordered = SPORT_OPTIONS.filter(s => sports.includes(s.slug)).map(s => s.slug);
  if (ordered.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
    >
      {ordered.map(slug => {
        const active = selected === slug;
        return (
          <Pressable
            key={slug}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${LABEL_BY_SLUG[slug] ?? slug}`}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(active ? null : slug)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.tint : theme.background,
                borderColor: active ? theme.tint : theme.border,
              },
            ]}
          >
            <Text style={styles.emoji}>{SPORT_EMOJI[slug] ?? '🏅'}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
  },
  row: {
    gap: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle lift so chips read against the map without a heavy card.
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  emoji: {
    fontSize: 17,
    lineHeight: 22,
  },
});
