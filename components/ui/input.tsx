import { Colors } from '@/constants/Colors';
import { StyleSheet, TextInput, TextInputProps, useColorScheme } from 'react-native';

export function Input(props: TextInputProps) {
  const colorScheme = useColorScheme();
  
  return (
    <TextInput 
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
        },
        props.style
      ]} 
      placeholderTextColor={Colors[colorScheme].mutedText}
    />
  );
}

export default Input;

