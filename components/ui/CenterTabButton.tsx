import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export default function CenterTabButton(props: BottomTabBarButtonProps) {
  const { accessibilityState, accessibilityRole, accessibilityLabel, testID } = props;
  const selected = accessibilityState?.selected;
  const router = useRouter();
  
  const handlePress = (e: any) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Navigate directly to create post instead of opening menu
    router.push('/create-post');
  };
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onPress={handlePress}
        style={[styles.button, selected && styles.buttonActive]}
      >
        <Text style={styles.plus}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    top: -6,
    width: 48,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonActive: {
    backgroundColor: '#0B1220',
  },
  plus: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
});
