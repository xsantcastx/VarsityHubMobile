import React from 'react';
import { Image, ImageProps, View, Text, StyleSheet } from 'react-native';

export function Avatar({ uri, size = 40 }: { uri?: string; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}> 
      <Text style={styles.fallbackText}>?</Text>
    </View>
  );
}

export function AvatarImage(props: ImageProps) {
  return <Image {...props} />;
}

export function AvatarFallback({ children }: { children?: React.ReactNode }) {
  return <View style={styles.fallback}><Text style={styles.fallbackText}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' },
  fallbackText: { fontWeight: '700', color: '#374151' },
});

export default Avatar;

