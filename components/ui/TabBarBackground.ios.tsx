import { useColorScheme } from '@/hooks/useColorScheme';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

export default function BlurTabBarBackground() {
  const colorScheme = useColorScheme();

  // In dark mode, use an opaque black background for maximum contrast
  if (colorScheme === 'dark') {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#000', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#262626' },
        ]}
      />
    );
  }

  // Light mode: keep native blur for a polished look
  return (
    <BlurView tint="light" intensity={100} style={StyleSheet.absoluteFill} />
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
