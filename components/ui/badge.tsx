import React from 'react';
import { View, Text, StyleSheet, ViewProps } from 'react-native';

export function Badge({ children, style }: { children?: React.ReactNode; style?: ViewProps['style'] }) {
  return (
    <View style={[styles.badge, style]}>
      {typeof children === 'string' ? <Text style={styles.text}>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6' },
  text: { fontSize: 12, fontWeight: '600', color: '#111827' },
});

export default Badge;

