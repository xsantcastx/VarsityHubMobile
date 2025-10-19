import { Colors } from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Card } from './card';

export interface StatCardProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  style?: ViewStyle;
}

/**
 * Reusable Stat Card Component
 * Displays statistics with optional trend indicators
 * 
 * @example
 * <StatCard 
 *   icon="trophy-outline"
 *   label="Wins"
 *   value={12}
 *   trend="up"
 *   trendValue="+3"
 * />
 */
export function StatCard({ 
  icon,
  label, 
  value, 
  subtitle,
  trend,
  trendValue,
  variant = 'default',
  style 
}: StatCardProps) {
  const colorScheme = useColorScheme() ?? 'light';

  // Get variant colors
  const getVariantColor = () => {
    switch (variant) {
      case 'primary':
        return '#2196F3';
      case 'success':
        return '#4caf50';
      case 'warning':
        return '#ff9800';
      case 'danger':
        return '#f44336';
      default:
        return Colors[colorScheme].text;
    }
  };

  const getTrendColor = () => {
    if (trend === 'up') return '#4caf50';
    if (trend === 'down') return '#f44336';
    return Colors[colorScheme].mutedText;
  };

  const getTrendIcon = (): keyof typeof Ionicons.glyphMap => {
    if (trend === 'up') return 'trending-up';
    if (trend === 'down') return 'trending-down';
    return 'remove';
  };

  const variantColor = getVariantColor();
  const trendColor = getTrendColor();

  return (
    <Card
      variant="elevated"
      style={style}
    >
      <View style={styles.container}>
        {/* Icon */}
        {icon && (
          <View style={styles.iconContainer}>
            <Ionicons 
              name={icon} 
              size={24} 
              color={variantColor} 
            />
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Label */}
          <Text 
            style={[
              styles.label,
              typography.caption,
              { color: Colors[colorScheme].mutedText }
            ]}
          >
            {label}
          </Text>

          {/* Value */}
          <Text 
            style={[
              styles.value,
              typography.title,
              { color: variantColor }
            ]}
          >
            {value}
          </Text>

          {/* Subtitle */}
          {subtitle && (
            <Text 
              style={[
                styles.subtitle,
                typography.caption,
                { color: Colors[colorScheme].mutedText }
              ]}
            >
              {subtitle}
            </Text>
          )}

          {/* Trend */}
          {trend && trendValue && (
            <View style={styles.trendRow}>
              <Ionicons 
                name={getTrendIcon()} 
                size={16} 
                color={trendColor} 
              />
              <Text 
                style={[
                  styles.trendText,
                  typography.caption,
                  { color: trendColor }
                ]}
              >
                {trendValue}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  label: {
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  value: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  trendText: {
    fontWeight: '600',
  },
});
