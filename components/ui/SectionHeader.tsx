import { Colors } from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Reusable Section Header Component
 * Replaces 50+ duplicated section headers across the app
 * 
 * @example
 * <SectionHeader 
 *   title="MY TEAMS" 
 *   subtitle="Manage your teams"
 *   action={<Button>Add</Button>}
 * />
 */
export function SectionHeader({ 
  title, 
  subtitle, 
  action, 
  style 
}: SectionHeaderProps) {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={[styles.container, style]}>
      <View style={styles.textContainer}>
        <Text 
          style={[
            styles.title, 
            typography.heading,
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
      </View>
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    // Style from typography
  },
  action: {
    marginLeft: spacing.md,
  },
});
