import { Colors } from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

export interface SettingItemProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  style?: ViewStyle;
}

/**
 * Reusable Setting Item Component
 * Replaces repeated settings item patterns across settings screens
 * 
 * @example
 * <SettingItem 
 *   icon="pencil-outline"
 *   label="Edit Team Info"
 *   onPress={handleEdit}
 * />
 * 
 * <SettingItem 
 *   icon="trash-outline"
 *   label="Delete Team"
 *   onPress={handleDelete}
 *   destructive={true}
 * />
 */
export function SettingItem({ 
  icon,
  label, 
  value, 
  onPress, 
  destructive = false,
  showChevron = true,
  style 
}: SettingItemProps) {
  const colorScheme = useColorScheme() ?? 'light';

  const textColor = destructive 
    ? '#f44336' 
    : Colors[colorScheme].text;
  
  const iconColor = destructive 
    ? '#f44336' 
    : Colors[colorScheme].icon;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed 
            ? Colors[colorScheme].surface 
            : Colors[colorScheme].card,
          borderBottomColor: Colors[colorScheme].border,
        },
        style,
      ]}
    >
      {/* Icon */}
      {icon && (
        <Ionicons 
          name={icon} 
          size={24} 
          color={iconColor} 
          style={styles.icon}
        />
      )}

      {/* Label and Value */}
      <View style={styles.textContainer}>
        <Text 
          style={[
            styles.label,
            typography.body,
            { color: textColor }
          ]}
        >
          {label}
        </Text>
        {value && (
          <Text 
            style={[
              styles.value,
              typography.caption,
              { color: Colors[colorScheme].mutedText }
            ]}
          >
            {value}
          </Text>
        )}
      </View>

      {/* Chevron */}
      {showChevron && (
        <Ionicons 
          name="chevron-forward" 
          size={20} 
          color={Colors[colorScheme].mutedText} 
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  icon: {
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontWeight: '500',
  },
  value: {
    marginTop: spacing.xs,
  },
});
