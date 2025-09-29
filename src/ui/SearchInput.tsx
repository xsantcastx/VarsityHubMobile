import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Color, Radius } from './tokens';

export default function SearchInput(props: TextInputProps) {
  return (
    <View style={S.wrap}>
      <Ionicons name="search" size={18} color={Color.placeholder} style={{ marginRight: 8 }} />
      <TextInput {...props} placeholderTextColor={Color.placeholder} style={S.input} />
    </View>
  );
}

const S = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 48, borderRadius: Radius.md,
    backgroundColor: Color.surface, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Color.border,
  },
  input: { flex: 1, color: Color.text },
});

