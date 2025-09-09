import React from 'react';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export default function CenterTabButton(props: BottomTabBarButtonProps) {
  const { onPress, accessibilityState, accessibilityRole, accessibilityLabel, testID } = props;
  const selected = accessibilityState?.selected;
  const handlePress = (e: any) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onPress={handlePress}
        style={[styles.button, selected && styles.buttonActive]}
      >
        <Text style={styles.plus}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    top: -12,
    width: 64,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: '#0B1220',
  },
  plus: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
});

