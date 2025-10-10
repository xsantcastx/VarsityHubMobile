/**
 * Accessible Button Component
 * 
 * Example component demonstrating WCAG 2.1 AA compliant button design
 * Uses accessibility utilities to ensure proper contrast and tap targets
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccessibleColors, MIN_TAP_TARGET_SIZE, TapTarget } from '../../constants/Accessibility';

interface AccessibleButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  size?: 'small' | 'medium' | 'large';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  fullWidth?: boolean;
}

/**
 * Accessible button component that meets WCAG 2.1 AA standards
 * - Minimum 44x44pt tap target
 * - Color contrast ratio ≥ 4.5:1 for normal text
 * - Accessible labels for screen readers
 * - Visual feedback on press
 */
export function AccessibleButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  disabled = false,
  fullWidth = false,
}: AccessibleButtonProps) {
  // Get accessible color pairs based on variant
  const getColors = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: AccessibleColors.primaryOnLight.background,
          text: '#FFFFFF',
          borderColor: AccessibleColors.primaryOnLight.text,
          bgPressed: '#1E40AF',
        };
      case 'danger':
        return {
          bg: AccessibleColors.errorOnLight.text,
          text: '#FFFFFF',
          borderColor: AccessibleColors.errorOnLight.text,
          bgPressed: '#7F1D1D',
        };
      case 'success':
        return {
          bg: AccessibleColors.successOnLight.text,
          text: '#FFFFFF',
          borderColor: AccessibleColors.successOnLight.text,
          bgPressed: '#064E3B',
        };
      case 'outline':
        return {
          bg: 'transparent',
          text: AccessibleColors.primaryOnLight.text,
          borderColor: AccessibleColors.primaryOnLight.text,
          bgPressed: '#F3F4F6',
        };
      case 'secondary':
      default:
        return {
          bg: '#F3F4F6',
          text: AccessibleColors.darkOnLight.text,
          borderColor: '#D1D5DB',
          bgPressed: '#E5E7EB',
        };
    }
  };

  const colors = getColors();

  // Size-based styling (all meet 44pt minimum)
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 10, // 44pt min with 24pt text = 10pt padding
          paddingHorizontal: 16,
          fontSize: 14,
        };
      case 'large':
        return {
          paddingVertical: 16,
          paddingHorizontal: 32,
          fontSize: 18,
        };
      case 'medium':
      default:
        return {
          paddingVertical: 12, // Ensures 44pt minimum
          paddingHorizontal: 24,
          fontSize: 16,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      hitSlop={TapTarget.expandedHitSlop} // Expands hit area for easier tapping
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed && !disabled ? colors.bgPressed : colors.bg,
          borderColor: colors.borderColor,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          minHeight: MIN_TAP_TARGET_SIZE,
          minWidth: MIN_TAP_TARGET_SIZE,
        },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        {icon && (
          <Ionicons
            name={icon}
            size={sizeStyles.fontSize + 4}
            color={disabled ? '#9CA3AF' : colors.text}
            style={styles.icon}
          />
        )}
        <Text
          style={[
            styles.text,
            {
              fontSize: sizeStyles.fontSize,
              color: disabled ? '#9CA3AF' : colors.text,
            },
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Minimum dimensions enforced via minHeight/minWidth
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  icon: {
    marginRight: 8,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
});
