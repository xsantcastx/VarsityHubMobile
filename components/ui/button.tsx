import React from 'react';
import {
  AccessibilityProps,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  useColorScheme,
  ViewStyle,
} from 'react-native';
import { Colors } from '@/constants/Colors';

type Variant = 'default' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends AccessibilityProps {
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export function Button({
  children,
  onPress,
  disabled,
  variant = 'default',
  size = 'md',
  style,
  textStyle,
  testID,
  ...accessibilityProps
}: ButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const vs = getVariantStyles(variant, theme);
  const ss = getSizeStyles(size);
  const content = React.Children.map(children, child =>
    renderButtonChild(child, [styles.text, vs.text, ss.text, textStyle])
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={[styles.base, vs.container, ss.container, disabled && styles.disabled, style]}
      {...accessibilityProps}
    >
      {content}
    </Pressable>
  );
}

function renderButtonChild(
  child: React.ReactNode,
  appliedTextStyle: React.ComponentProps<typeof Text>['style']
) {
  if (typeof child === 'string' || typeof child === 'number') {
    return <Text style={appliedTextStyle}>{String(child)}</Text>;
  }

  if (!React.isValidElement(child)) {
    return child;
  }

  if (child.type === Text) {
    const textChild = child as React.ReactElement<{ style?: React.ComponentProps<typeof Text>['style'] }>;
    return React.cloneElement(textChild, {
      style: [appliedTextStyle, textChild.props.style],
    });
  }

  return child;
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  text: { fontWeight: '600' },
  disabled: { opacity: 0.6 },
});

function getVariantStyles(
  variant: Variant,
  theme: typeof Colors.light
): { container: ViewStyle; text: TextStyle } {
  switch (variant) {
    case 'outline':
      return {
        container: { backgroundColor: 'transparent', borderColor: theme.border },
        text: { color: theme.text },
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent', borderColor: 'transparent' },
        text: { color: theme.text },
      };
    default:
      return {
        container: { backgroundColor: theme.text, borderColor: theme.text },
        text: { color: theme.background },
      };
  }
}

function getSizeStyles(size: Size): { container: ViewStyle; text: TextStyle } {
  switch (size) {
    case 'sm':
      return {
        container: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
        text: { fontSize: 14 },
      };
    case 'lg':
      return {
        container: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12 },
        text: { fontSize: 17, fontWeight: '600' as const },
      };
    case 'icon':
      return {
        container: { padding: 10, width: 44, height: 44, borderRadius: 999 },
        text: { fontSize: 16 },
      };
    default:
      return { container: { paddingVertical: 12, paddingHorizontal: 16 }, text: { fontSize: 16 } };
  }
}

export default Button;
