import { buildEventDetailRoute } from '@/utils/eventRoutes';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Compact "open the event/game page" affordance for post previews.
 *
 * Every post is denormalized with game_id + event_id at write time
 * (server backfills the missing half), so any surface that renders a post
 * can offer this chip. game-linked posts open the rich game page;
 * event-only posts open the event page (via the canonical helper, which
 * itself bounces game-linked events to the game screen).
 *
 * Renders nothing when the post has no linkage.
 */
export default function EventChip({
  gameId,
  eventId,
  label,
  variant = 'overlay',
  style,
  onPress,
}: {
  gameId?: string | null;
  eventId?: string | null;
  /** Optional title (e.g. "Portugal vs Croatia"); falls back to a generic label. */
  label?: string | null;
  /** overlay = translucent pill for media overlays; card = subtle bordered pill for cards. */
  variant?: 'overlay' | 'card';
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const router = useRouter();
  const hasGame = !!(gameId && String(gameId).trim());
  const hasEvent = !!(eventId && String(eventId).trim());
  if (!hasGame && !hasEvent) return null;

  const text = label?.trim() || (hasGame ? 'View game' : 'View event');

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (hasGame) {
      void router.push({ pathname: '/game/[id]', params: { id: String(gameId).trim() } });
      return;
    }
    void router.push(buildEventDetailRoute(String(eventId)));
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={6}
      style={[styles.chip, variant === 'card' ? styles.card : styles.overlay, style]}
      accessibilityRole="button"
      accessibilityLabel={hasGame ? 'Open game page' : 'Open event page'}
    >
      <Ionicons
        name={hasGame ? 'trophy-outline' : 'calendar-outline'}
        size={12}
        color={variant === 'card' ? '#2563EB' : '#fff'}
      />
      <Text
        style={[styles.text, variant === 'card' ? styles.cardText : styles.overlayText]}
        numberOfLines={1}
      >
        {text}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={12}
        color={variant === 'card' ? '#2563EB' : 'rgba(255,255,255,0.85)'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: 220,
  },
  overlay: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  card: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  overlayText: {
    color: '#fff',
  },
  cardText: {
    color: '#2563EB',
  },
});
