import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

export function Label({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.label, style]} />;
}

const styles = StyleSheet.create({
  label: { fontSize: 14, color: '#374151' },
});

export default Label;

