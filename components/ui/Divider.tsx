import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

export type DividerProps = {
  orientation?: 'horizontal' | 'vertical';
  inset?: number;
  color?: string;
  thickness?: number;
  style?: ViewStyle;
};

export function Divider({
  orientation = 'horizontal',
  inset = 0,
  color = '#E5E7EB',
  thickness = StyleSheet.hairlineWidth,
  style,
}: DividerProps) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      accessibilityRole="none"
      style={[
        isHorizontal
          ? {
              height: thickness,
              marginHorizontal: inset,
              backgroundColor: color,
            }
          : {
              width: thickness,
              marginVertical: inset,
              backgroundColor: color,
              alignSelf: 'stretch',
            },
        style,
      ]}
    />
  );
}
