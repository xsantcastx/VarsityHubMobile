import { Colors } from '@/constants/Colors';
import { StyleSheet, Text, TextProps, useColorScheme } from 'react-native';

export function Label({ style, ...props }: TextProps) {
  const cs = useColorScheme() ?? 'light';
  return <Text {...props} style={[styles.label, { color: Colors[cs].mutedText }, style]} />;
}

const styles = StyleSheet.create({
  label: { fontSize: 14 },
});

export default Label;

