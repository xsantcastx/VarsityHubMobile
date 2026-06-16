import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const IOS_APP_STORE_URL = 'https://apps.apple.com/us/app/varsityhub/id6758405187';
const DISMISS_KEY = 'vh:web-install-cta:dismissed';

export function WebInstallCta() {
  const colorScheme = useColorScheme() ?? 'light';
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === 'true');
  }, []);

  if (Platform.OS !== 'web') return null;

  if (dismissed) return null;

  const palette = Colors[colorScheme];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colorScheme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.92)',
          borderColor: colorScheme === 'dark' ? 'rgba(148, 163, 184, 0.28)' : 'rgba(15, 23, 42, 0.08)',
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hide App Store download button"
        onPress={() => {
          window.localStorage.setItem(DISMISS_KEY, 'true');
          setDismissed(true);
        }}
        style={[
          styles.dismissButton,
          {
            backgroundColor: colorScheme === 'dark' ? '#0B1120' : '#F8FAFC',
            borderColor: palette.border,
          },
        ]}
      >
        <MaterialIcons name="close" size={14} color={palette.mutedText} />
      </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // react-native's ViewStyle type omits 'fixed'; it is valid on web via
    // react-native-web, and this component renders only on web. Cast keeps the
    // runtime value 'fixed' while satisfying the stock RN type in clean CI.
    position: 'fixed' as any,
    top: 88,
    right: 16,
    zIndex: 9999,
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    boxShadow: '0px 12px 28px rgba(15, 23, 42, 0.18)',
  },
  dismissButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  button: {
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
