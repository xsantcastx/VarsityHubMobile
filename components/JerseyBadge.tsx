import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';

/**
 * Jersey badge component that displays a jersey number with customizable colors.
 * 
 * Features:
 * - 6 color variant combinations based on jersey number ranges
 * - Sport-specific emojis (basketball 🏀, football 🏈, baseball ⚾, soccer ⚽)
 * - Team color theming support
 * - Responsive sizing
 * 
 * Color Variants (based on jersey number):
 * - 0-16: Red/White/Black
 * - 17-33: Gold/Green
 * - 34-50: Navy/Gold
 * - 51-67: Maroon/White/Gold
 * - 68-84: Black/White/Red
 * - 85-99: White/Navy/Gold
 */

export type Sport = 'basketball' | 'football' | 'baseball' | 'soccer' | 'volleyball' | 'other';

export interface JerseyBadgeProps {
  /** Jersey number to display (0-99) */
  jerseyNumber: number | string;
  
  /** Sport type for emoji selection */
  sport?: Sport;
  
  /** Optional team color to override variant colors */
  teamColor?: string;
  
  /** Size of the badge */
  size?: 'small' | 'medium' | 'large';
  
  /** Additional custom styles */
  style?: ViewStyle;
}

/**
 * Get sport emoji based on sport type
 */
function getSportEmoji(sport: Sport = 'other'): string {
  const emojiMap: Record<Sport, string> = {
    basketball: '🏀',
    football: '🏈',
    baseball: '⚾',
    soccer: '⚽',
    volleyball: '🏐',
    other: '🏆',
  };
  return emojiMap[sport] || '🏆';
}

/**
 * Get color variant based on jersey number
 * Returns [primaryColor, secondaryColor, accentColor]
 */
function getColorVariant(jerseyNumber: number | string): [string, string, string] {
  const num = typeof jerseyNumber === 'string' ? parseInt(jerseyNumber, 10) : jerseyNumber;
  
  // Handle invalid numbers
  if (isNaN(num)) return ['#ef4444', '#ffffff', '#000000']; // Red/White/Black
  
  // Determine variant based on number range
  if (num >= 0 && num <= 16) {
    return ['#ef4444', '#ffffff', '#000000']; // Red/White/Black
  } else if (num >= 17 && num <= 33) {
    return ['#f59e0b', '#10b981', '#ffffff']; // Gold/Green/White
  } else if (num >= 34 && num <= 50) {
    return ['#1e3a8a', '#f59e0b', '#ffffff']; // Navy/Gold/White
  } else if (num >= 51 && num <= 67) {
    return ['#7f1d1d', '#ffffff', '#f59e0b']; // Maroon/White/Gold
  } else if (num >= 68 && num <= 84) {
    return ['#000000', '#ffffff', '#ef4444']; // Black/White/Red
  } else {
    return ['#ffffff', '#1e3a8a', '#f59e0b']; // White/Navy/Gold
  }
}

/**
 * Get size dimensions based on size prop
 */
function getSizeDimensions(size: 'small' | 'medium' | 'large' = 'medium') {
  const sizes = {
    small: { width: 40, height: 50, fontSize: 18, emojiSize: 10 },
    medium: { width: 50, height: 62, fontSize: 22, emojiSize: 12 },
    large: { width: 60, height: 75, fontSize: 28, emojiSize: 14 },
  };
  return sizes[size];
}

export function JerseyBadge({
  jerseyNumber,
  sport = 'other',
  teamColor,
  size = 'medium',
  style,
}: JerseyBadgeProps) {
  const [primaryColor, secondaryColor, accentColor] = getColorVariant(jerseyNumber);
  const dimensions = getSizeDimensions(size);
  const emoji = getSportEmoji(sport);
  
  // Use team color as primary if provided
  const bgColor = teamColor || primaryColor;
  
  return (
    <View
      style={[
        styles.container,
        {
          width: dimensions.width,
          height: dimensions.height,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      {/* Jersey number */}
      <Text
        style={[
          styles.number,
          {
            fontSize: dimensions.fontSize,
            color: secondaryColor,
            ...(Platform.OS === 'web'
              ? { textShadow: `1px 1px 2px ${accentColor}` }
              : { textShadowColor: accentColor }),
          },
        ]}
      >
        {jerseyNumber}
      </Text>
      
      {/* Sport emoji */}
      <Text style={[styles.emoji, { fontSize: dimensions.emojiSize }]}>
        {emoji}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }),
    elevation: 5,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  number: {
    fontWeight: '900',
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? { textShadow: '1px 1px 2px rgba(0, 0, 0, 0.35)' }
      : {
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 2,
        }),
    letterSpacing: -0.5,
  },
  emoji: {
    marginTop: 2,
  },
});
