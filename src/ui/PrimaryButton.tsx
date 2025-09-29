import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Color, Radius, Spacing, Type } from './tokens';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export default function PrimaryButton({ label, onPress, disabled, loading, testID }: Props) {
  const isDisabled = !!disabled || !!loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        pressed && !isDisabled ? { backgroundColor: Color.primaryAlt } : null,
        isDisabled ? { opacity: 0.55 } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Color.primaryText} />
      ) : (
        <>
          <Text style={styles.txt}>{label}</Text>
          <Ionicons name="arrow-forward" size={18} color={Color.primaryText} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Color.primary,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  txt: { ...Type.button, color: Color.primaryText },
});

