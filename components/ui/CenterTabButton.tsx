import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function CenterTabButton(props: BottomTabBarButtonProps) {
  const {
    accessibilityState,
    accessibilityRole,
    accessibilityLabel = 'Create post',
    testID: _testID,
  } = props;
  const selected = accessibilityState?.selected;
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Go straight to Create Post — no intermediate "Create" sheet. Team
    // creation lives only in the coach Quick Actions, not the + tab.
    void router.push('/create-post');
  };

  return (
    <PlatformPressable
      {...props}
      onPress={handlePress}
      onPressIn={ev => props.onPressIn?.(ev)}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Double tap to create a new post"
      style={[styles.wrapper, props.style]}
    >
      <View style={styles.buttonContainer}>
        <View
          style={[styles.button, selected && styles.buttonActive, { backgroundColor: theme.tint }]}
        >
          <Text style={styles.plus}>+</Text>
        </View>
      </View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    top: -6,
    width: '100%', // Take full width of the tab slot
    flex: 1, // Ensure equal space with other tabs
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    display: 'flex',
  },
  buttonActive: {
    opacity: 0.85,
  },
  plus: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    // Remove lineHeight to let it be natural, and fine-tune positioning
    includeFontPadding: false, // Android: remove extra padding
    textAlignVertical: 'center', // Android: vertical center
    marginTop: Platform.OS === 'ios' ? -1 : 0, // iOS fine-tuning
  },
});
