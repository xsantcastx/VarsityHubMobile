import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

type Variant = 'default' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps {
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  children,
  onPress,
  disabled,
  variant = 'default',
  size = 'md',
  style,
  textStyle,
}: ButtonProps) {
  const vs = getVariantStyles(variant);
  const ss = getSizeStyles(size);
  const content = React.Children.map(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return (
        <Text style={[styles.text, vs.text, ss.text, textStyle]}>{String(child)}</Text>
      );
    }
    return child;
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.base, vs.container, ss.container, disabled && styles.disabled, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontWeight: '600' },
  disabled: { opacity: 0.6 },
});

function getVariantStyles(variant: Variant) {
  switch (variant) {
    case 'outline':
      return { container: { backgroundColor: 'transparent', borderColor: '#D1D5DB' }, text: { color: '#111827' } };
    case 'ghost':
      return { container: { backgroundColor: 'transparent', borderColor: 'transparent' }, text: { color: '#111827' } };
    default:
      return { container: { backgroundColor: '#111827', borderColor: '#111827' }, text: { color: 'white' } };
  }
}

function getSizeStyles(size: Size) {
  switch (size) {
    case 'sm':
      return { container: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 }, text: { fontSize: 14 } };
    case 'lg':
      return { container: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14 }, text: { fontSize: 18 } };
    case 'icon':
      return { container: { padding: 10, width: 44, height: 44, borderRadius: 999 }, text: { fontSize: 16 } };
    default:
      return { container: {}, text: { fontSize: 16 } };
  }
}

export default Button;

