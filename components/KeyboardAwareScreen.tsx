import React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ScrollViewProps,
    StyleSheet,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface KeyboardAwareScreenProps extends ScrollViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Override the keyboard vertical offset (default: 0 on iOS) */
  keyboardVerticalOffset?: number;
}

const KeyboardAwareScreen: React.FC<KeyboardAwareScreenProps> = ({
  children,
  style,
  keyboardVerticalOffset,
  ...scrollViewProps
}) => {
  const insets = useSafeAreaInsets();

  // Extract backgroundColor from the style prop so it propagates to all layers
  const bgColor = (style as any)?.backgroundColor ?? undefined;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, bgColor ? { backgroundColor: bgColor } : undefined]}
      keyboardVerticalOffset={keyboardVerticalOffset ?? (Platform.OS === 'ios' ? 0 : -insets.top)}
    >
      <ScrollView
        style={[styles.container, style]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom },
          bgColor ? { backgroundColor: bgColor } : undefined,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});

export default KeyboardAwareScreen;
