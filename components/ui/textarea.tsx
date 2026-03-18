import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, TextInput, TextInputProps, useColorScheme } from 'react-native';

const Textarea = React.forwardRef<TextInput, TextInputProps>((props, ref) => {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <TextInput
      ref={ref}
      {...props}
      multiline
      style={[
        styles.input,
        {
          borderColor: Colors[colorScheme].border,
          backgroundColor: Colors[colorScheme].surface,
          color: Colors[colorScheme].text,
        },
        props.style,
      ]}
      placeholderTextColor={Colors[colorScheme].mutedText}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
});

export default Textarea;

