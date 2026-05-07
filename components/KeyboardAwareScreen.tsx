import React from 'react';
import {
    ScrollView,
    ScrollViewProps,
    StyleSheet,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface KeyboardAwareScreenProps extends ScrollViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

const KeyboardAwareScreen: React.FC<KeyboardAwareScreenProps> = ({
  children,
  style,
  ...scrollViewProps
}) => {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      children={children}
      {...scrollViewProps}
    />
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
