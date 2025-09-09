import React from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';

export function Textarea(props: TextInputProps) {
  return <TextInput {...props} multiline style={[styles.input, props.style]} />;
}

const styles = StyleSheet.create({
  input: {
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
    textAlignVertical: 'top',
  },
});

export default Textarea;

