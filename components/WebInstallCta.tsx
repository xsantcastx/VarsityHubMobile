import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

const IOS_APP_STORE_URL = 'https://apps.apple.com/us/app/varsityhub/id6758405187';

export function WebInstallCta() {
  const colorScheme = useColorScheme() ?? 'light';
  if (Platform.OS !== 'web') return null;

  const palette = Colors[colorScheme];

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Download VarsityHub on the App Store"
      onPress={() => {
        window.location.href = IOS_APP_STORE_URL;
      }}
      style={[
        styles.button,
        {
          backgroundColor: palette.tint,
          borderColor: palette.tint,
        },
      ]}
    >
      <MaterialIcons name="download" size={16} color="#FFFFFF" />
      <Text style={styles.text}>Download on the App Store</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'fixed',
    top: 88,
    right: 16,
    zIndex: 9999,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0px 12px 28px rgba(15, 23, 42, 0.18)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
