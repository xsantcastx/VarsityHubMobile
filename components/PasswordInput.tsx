import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type Props = Omit<TextInputProps, 'secureTextEntry'> & { containerStyle?: ViewStyle };

// Secure text input with a show/hide eye toggle. Wraps the shared Input so
// borders/colors match every other field; the eye sits inside the field.
const PasswordInput = forwardRef<TextInput, Props>(
  ({ containerStyle, style, testID, ...props }, ref) => {
    const colorScheme = useColorScheme() ?? 'light';
    const [visible, setVisible] = useState(false);
    return (
      <View style={[styles.wrap, containerStyle]}>
        <Input
          ref={ref}
          testID={testID}
          {...props}
          secureTextEntry={!visible}
          style={[style, styles.inputPadding]}
        />
        <Pressable
          testID={testID ? `${testID}-visibility-toggle` : 'password-visibility-toggle'}
          onPress={() => setVisible(v => !v)}
          hitSlop={10}
          style={styles.eye}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <Ionicons
            name={visible ? 'eye-off' : 'eye'}
            size={20}
            color={Colors[colorScheme].mutedText}
          />
        </Pressable>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  inputPadding: { paddingRight: 44 },
  eye: { position: 'absolute', right: 12, height: '100%', justifyContent: 'center' },
});

export default PasswordInput;
