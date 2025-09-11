import React from 'react';
import { View, Text, StyleSheet, ViewProps } from 'react-native';

export function Badge({ children, style }: { children?: React.ReactNode; style?: ViewProps['style'] }) {
  const isPrimitive = (v: any) => typeof v === 'string' || typeof v === 'number';
  const arrayIsPrimitive = Array.isArray(children) && children.every(isPrimitive);
  const shouldWrapInText = isPrimitive(children) || arrayIsPrimitive;
  return (
    <View style={[styles.badge, style]}>
      {shouldWrapInText ? <Text style={styles.text}>{children as any}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6' },
  text: { fontSize: 12, fontWeight: '600', color: '#111827' },
});

export default Badge;
