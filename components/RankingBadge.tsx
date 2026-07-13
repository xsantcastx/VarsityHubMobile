import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

export type RankingType =
  | 'trending'
  | 'national'
  | 'hot'
  | 'rising'
  | 'local'
  | 'viral'
  | 'live'
  | 'recent'
  | 'top';

interface RankingBadgeProps {
  type: RankingType;
  position?: number;
  style?: any;
}

const getRankingConfig = (type: RankingType, _position?: number) => {
  switch (type) {
    case 'trending':
      return {
        colors: ['#F59E0B', '#D97706'] as const, // Amber/Orange gradient
        text: 'TRENDING',
        icon: '🔥',
      };
    case 'national':
      return {
        colors: ['#3B82F6', '#1D4ED8'] as const, // Blue gradient
        text: 'NATIONAL',
        icon: '🇺🇸',
      };
    case 'hot':
      return {
        colors: ['#EF4444', '#DC2626'] as const, // Red gradient
        text: 'HOT',
        icon: '🌶️',
      };
    case 'rising':
      return {
        colors: ['#10B981', '#059669'] as const, // Green gradient
        text: 'RISING',
        icon: '📈',
      };
    case 'local':
      return {
        colors: ['#8B5CF6', '#7C3AED'] as const, // Purple gradient
        text: 'LOCAL',
        icon: '📍',
      };
    case 'viral':
      return {
        colors: ['#EC4899', '#DB2777'] as const, // Pink gradient
        text: 'VIRAL',
        icon: '💥',
      };
    case 'live':
      return {
        colors: ['#F97316', '#EA580C'] as const, // Orange gradient
        text: 'LIVE',
        icon: '🔴',
      };
    case 'recent':
      return {
        colors: ['#06B6D4', '#0891B2'] as const, // Cyan gradient
        text: 'RECENT',
        icon: '⚡',
      };
    case 'top':
      return {
        colors: ['#8B5CF6', '#7C3AED'] as const, // Purple gradient
        text: 'TOP',
        icon: '👑',
      };
    default:
      return {
        colors: ['#6B7280', '#4B5563'] as const, // Gray gradient
        text: 'FEATURED',
        icon: '✨',
      };
  }
};

export const RankingBadge: React.FC<RankingBadgeProps> = ({ type, position: _position, style }) => {
  const config = getRankingConfig(type, _position);

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <Text style={styles.icon}>{config.icon}</Text>
        <Text style={styles.text}>{config.text}</Text>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    borderRadius: 12,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)' }
      : {
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }),
    elevation: 5,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
  },
  icon: {
    fontSize: 10,
    marginRight: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    ...(Platform.OS === 'web'
      ? { textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3)' }
      : {
          textShadowColor: 'rgba(0, 0, 0, 0.3)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }),
  },
});

export default RankingBadge;
