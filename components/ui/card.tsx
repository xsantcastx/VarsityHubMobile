import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

export function CardHeader({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.section, style]} />;
}

export function CardContent({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.section, style]} />;
}

export function CardFooter({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.section, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  section: { padding: 12 },
});

export default Card;

