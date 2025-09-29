import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Hook to get theme-aware style properties
 */
export function useThemedStyles() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return {
    colors,
    backgroundColor: colors.background,
    cardBackground: colors.card,
    surfaceBackground: colors.surface,
    elevatedBackground: colors.elevated,
    textColor: colors.text,
    mutedTextColor: colors.mutedText,
    borderColor: colors.border,
    tintColor: colors.tint,
    iconColor: colors.icon,
  };
}

/**
 * Common themed styles that can be reused across screens
 */
export function useCommonThemedStyles() {
  const { colors } = useThemedStyles();

  return {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
    },
    surface: {
      backgroundColor: colors.surface,
    },
    text: {
      color: colors.text,
    },
    mutedText: {
      color: colors.mutedText,
    },
    border: {
      borderColor: colors.border,
    },
    input: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      color: colors.text,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
    },
  };
}