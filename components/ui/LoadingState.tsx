import { Colors } from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';

export interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
  fullScreen?: boolean;
  style?: ViewStyle;
}

/**
 * Reusable Loading State Component
 * Replaces repeated loading indicator patterns
 * 
 * @example
 * <LoadingState message="Loading games..." />
 * 
 * <LoadingState fullScreen size="large" />
 */
export function LoadingState({ 
  message = 'Loading...',
  size = 'large',
  fullScreen = false,
  style 
}: LoadingStateProps) {
  const colorScheme = useColorScheme() ?? 'light';

  const containerStyle = fullScreen 
    ? styles.fullScreenContainer 
    : styles.container;

  return (
    <View style={[containerStyle, style]}>
      <ActivityIndicator 
        size={size} 
        color={Colors[colorScheme].tint} 
      />
      {message && (
        <Text 
          style={[
            styles.message,
            typography.body,
            { color: Colors[colorScheme].mutedText }
          ]}
        >
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  fullScreenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  message: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
