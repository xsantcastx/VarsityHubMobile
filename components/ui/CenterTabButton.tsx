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
      <View style={styles.buttonContainer}>
        <Pressable
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          onPress={handlePress}
          style={[styles.button, selected && styles.buttonActive]}
        >
          <View style={styles.plusContainer}>
            <Text style={styles.plus}>+</Text>
          </View>
        </Pressable>
      </View>
    </View>
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
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    // Ensure perfect centering
    display: 'flex',
  },
  buttonActive: {
    backgroundColor: '#0B1220',
  },
  plusContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
