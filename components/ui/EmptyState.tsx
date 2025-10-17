import { Colors } from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Reusable Empty State Component
 * Replaces 12+ duplicated empty state implementations
 * 
 * @example
 * <EmptyState 
 *   icon="calendar-outline"
 *   title="No Games Yet" 
 *   subtitle="Add your first game to get started"
 *   action={<Button>Add Game</Button>}
 * />
 */
export function EmptyState({ 
  icon = 'alert-circle-outline',
  title, 
  subtitle, 
  action, 
  style 
}: EmptyStateProps) {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={[styles.container, style]}>
      <Ionicons 
        name={icon} 
        size={64} 
        color={Colors[colorScheme].mutedText} 
      />
      <Text 
        style={[
          styles.title,
          typography.title,
          { color: Colors[colorScheme].text }
        ]}
      >
        {title}
      </Text>
      {subtitle && (
        <Text 
          style={[
            styles.subtitle,
            typography.body,
            { color: Colors[colorScheme].mutedText }
          ]}
        >
          {subtitle}
        </Text>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  title: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  action: {
    marginTop: spacing.md,
  },
});
