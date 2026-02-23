import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, TextInput, TextInputProps, useColorScheme } from 'react-native';

const Input = React.forwardRef<TextInput, TextInputProps>((props, ref) => {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <TextInput
      ref={ref}
      {...props}
      style={[
        {
          height: 44,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: Colors[colorScheme].border,
          borderRadius: 10,
          paddingHorizontal: 12,
          backgroundColor: Colors[colorScheme].surface,
          color: Colors[colorScheme].text,
          fontSize: 16,
          letterSpacing: 0,
        },
        props.style,
      ]}
      placeholderTextColor={Colors[colorScheme].mutedText}
    />
  );
});

export { Input };

export default Input;

