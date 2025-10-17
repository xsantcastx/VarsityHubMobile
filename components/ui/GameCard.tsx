import { Colors } from '@/constants/Colors';
import { radius, spacing, typography } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Card } from './card';

// Game interface matching the one used in manage-season.tsx
export interface Game {
  id: string;
  opponent?: string;
  opponent_name?: string;
  homeTeam?: string;
  awayTeam?: string;
  date?: string;
  scheduled_date?: string;
  time?: string;
  scheduled_time?: string;
  location?: string;
  type?: 'home' | 'away' | 'neutral';
  game_type?: string;
  status?: 'upcoming' | 'completed' | 'cancelled';
  banner_url?: string;
  cover_image_url?: string;
  home_score?: number | null;
  away_score?: number | null;
  score?: {
    team: number;
    opponent: number;
  };
}

export interface GameCardProps {
  game: Game;
  onPress?: (game: Game) => void;
  onEdit?: (game: Game) => void;
  onDelete?: (game: Game) => void;
  showActions?: boolean;
  style?: ViewStyle;
}

/**
 * Reusable Game Card Component
 * Replaces 10+ duplicated game card implementations (250+ lines)
 * 
 * @example
 * <GameCard 
 *   game={game}
 *   onPress={handlePress}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   showActions={true}
 * />
 */
export function GameCard({ 
  game, 
  onPress, 
  onEdit, 
  onDelete, 
  showActions = false,
  style 
}: GameCardProps) {
  const colorScheme = useColorScheme() ?? 'light';

  // Format date and time
  const gameDate = game.scheduled_date ? format(new Date(game.scheduled_date), 'MMM dd, yyyy') : 'TBD';
  const gameTime = game.scheduled_time || 'TBD';

  // Determine game type badge color
  const getGameTypeBadge = () => {
    const type = game.game_type?.toLowerCase();
    let backgroundColor = Colors[colorScheme].surface;
    let textColor = Colors[colorScheme].text;

    if (type === 'league') {
      backgroundColor = '#e3f2fd';
      textColor = '#1976d2';
    } else if (type === 'playoff') {
      backgroundColor = '#fce4ec';
      textColor = '#c2185b';
    } else if (type === 'tournament') {
      backgroundColor = '#f3e5f5';
      textColor = '#7b1fa2';
    }

    return (
      <View style={[styles.badge, { backgroundColor }]}>
        <Text style={[styles.badgeText, typography.caption, { color: textColor }]}>
          {game.game_type || 'Regular'}
        </Text>
      </View>
    );
  };

  // Determine if game is past
  const isPastGame = game.scheduled_date 
    ? new Date(game.scheduled_date) < new Date()
    : false;

  return (
    <Card
      variant="outlined"
      pressable={!!onPress}
      onPress={onPress ? () => onPress(game) : undefined}
      style={style}
    >
      {/* Header: Opponent and Type Badge */}
      <View style={styles.header}>
        <Text 
          style={[
            styles.opponent, 
            typography.heading,
            { color: Colors[colorScheme].text }
          ]}
          numberOfLines={1}
        >
          vs {game.opponent_name || 'TBD'}
        </Text>
        {getGameTypeBadge()}
      </View>

      {/* Date and Time */}
      <View style={styles.infoRow}>
        <Ionicons name="calendar-outline" size={16} color={Colors[colorScheme].mutedText} />
        <Text 
          style={[
            styles.infoText, 
            typography.body,
            { color: Colors[colorScheme].mutedText }
          ]}
        >
          {gameDate}
        </Text>
        <Ionicons 
          name="time-outline" 
          size={16} 
          color={Colors[colorScheme].mutedText} 
          style={styles.iconSpacing}
        />
        <Text 
          style={[
            styles.infoText, 
            typography.body,
            { color: Colors[colorScheme].mutedText }
          ]}
        >
          {gameTime}
        </Text>
      </View>

      {/* Location (if available) */}
      {game.location && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={Colors[colorScheme].mutedText} />
          <Text 
            style={[
              styles.infoText, 
              typography.body,
              { color: Colors[colorScheme].mutedText }
            ]}
            numberOfLines={1}
          >
            {game.location}
          </Text>
        </View>
      )}

      {/* Score (for past games) */}
      {isPastGame && (game.home_score !== null || game.away_score !== null) && (
        <View style={styles.scoreRow}>
          <Text 
            style={[
              styles.scoreText, 
              typography.title,
              { color: Colors[colorScheme].text }
            ]}
          >
            {game.home_score ?? '-'} - {game.away_score ?? '-'}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      {showActions && (onEdit || onDelete) && (
        <View style={styles.actions}>
          {onEdit && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onEdit(game);
              }}
              style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
            >
              <Ionicons name="pencil" size={16} color="white" />
              <Text style={[styles.actionText, typography.caption]}>Edit</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDelete(game);
              }}
              style={[styles.actionButton, { backgroundColor: '#f44336' }]}
            >
              <Ionicons name="trash" size={16} color="white" />
              <Text style={[styles.actionText, typography.caption]}>Delete</Text>
            </Pressable>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  opponent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  infoText: {
    marginLeft: spacing.xs,
  },
  iconSpacing: {
    marginLeft: spacing.md,
  },
  scoreRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  scoreText: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  actionText: {
    color: 'white',
    fontWeight: '600',
  },
});
