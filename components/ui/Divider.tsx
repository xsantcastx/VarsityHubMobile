import { Colors } from '@/constants/Colors';
import { borderWidth } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

export interface DividerProps {
  /** 'thin' (1px) for list items, 'medium' (2px) for section boundaries */
  weight?: 'thin' | 'medium';
  /** Optional margin vertical for spacing around the line */
  marginVertical?: number;
  style?: ViewStyle;
}

/**
 * Horizontal divider line for clear visual separation between sections and list items.
 * Use for strong workflow boundaries: between sections, after section headers, between card groups.
 */
export function Divider({
  weight = 'thin',
  marginVertical = 0,
  style,
}: DividerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const lineWidth = weight === 'medium' ? borderWidth.medium : borderWidth.thin;

  return (
    <View
      style={[
        styles.line,
        {
          height: lineWidth,
          backgroundColor: Colors[colorScheme].border,
          marginVertical,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    width: '100%',
  },
});
