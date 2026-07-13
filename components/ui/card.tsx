import { Colors } from '@/constants/Colors';
import { borderWidth, radius, shadows, spacing } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Pressable, StyleSheet, View, ViewProps } from 'react-native';

export interface CardProps extends ViewProps {
  /** default: no border (flat). outlined: 1px border. strong: 2px border for major workflow/section boundaries. elevated: shadow only. */
  variant?: 'default' | 'elevated' | 'outlined' | 'strong';
  pressable?: boolean;
  onPress?: () => void;
  padding?: keyof typeof spacing;
}

/**
 * Enhanced Card Component
 * Supports theme, variants, and pressable functionality
 */
export function Card({
  style,
  variant = 'outlined',
  pressable = false,
  onPress,
  padding = 'lg',
  ...props
}: CardProps) {
  const colorScheme = useColorScheme() ?? 'light';

  const Wrapper = pressable ? Pressable : View;

  const borderStyle =
    variant === 'default'
      ? { borderWidth: 0 }
      : variant === 'strong'
        ? { borderWidth: borderWidth.medium, borderColor: Colors[colorScheme].border }
        : { borderWidth: borderWidth.thin, borderColor: Colors[colorScheme].border };

  const cardStyle = [
    styles.card,
    {
      backgroundColor: Colors[colorScheme].surface,
      padding: spacing[padding],
      ...borderStyle,
    },
    variant === 'elevated' && shadows.md,
    style,
  ];

  return (
    <Wrapper {...(props as any)} style={cardStyle} onPress={pressable ? onPress : undefined} />
  );
}

export function CardHeader({ style, ...props }: ViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  return (
    <View
      {...props}
      style={[styles.section, { borderBottomColor: Colors[colorScheme].border }, style]}
    />
  );
}

export function CardContent({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.section, style]} />;
}

export function CardFooter({ style, ...props }: ViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  return (
    <View
      {...props}
      style={[styles.section, { borderTopColor: Colors[colorScheme].border }, style]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  section: {
    padding: spacing.md,
  },
});

export default Card;
