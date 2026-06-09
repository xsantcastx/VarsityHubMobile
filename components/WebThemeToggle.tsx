import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemePreference } from '@/hooks/useCustomColorScheme';
import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type ThemeOption = 'light' | 'dark';

const OPTIONS: Array<{ value: ThemeOption; label: string; icon: ComponentProps<typeof MaterialIcons>['name'] }> = [
  { value: 'light', label: 'Light', icon: 'light-mode' },
  { value: 'dark', label: 'Dark', icon: 'dark-mode' },
];

export function WebThemeToggle() {
  const colorScheme = useColorScheme() ?? 'light';
  const { themePreference, setThemePreference } = useThemePreference();

  if (Platform.OS !== 'web') return null;

  const palette = Colors[colorScheme];
  const selectedTheme = themePreference === 'system' ? colorScheme : themePreference;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colorScheme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.92)',
          borderColor: colorScheme === 'dark' ? 'rgba(148, 163, 184, 0.28)' : 'rgba(15, 23, 42, 0.08)',
        },
      ]}
      pointerEvents="box-none"
    >
      <Text style={[styles.label, { color: palette.mutedText }]}>Theme</Text>
      <View
        style={[
          styles.segmented,
          {
            backgroundColor: colorScheme === 'dark' ? '#0B1120' : '#F3F4F6',
            borderColor: palette.border,
          },
        ]}
      >
        {OPTIONS.map(option => {
          const selected = selectedTheme === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => void setThemePreference(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={`Switch to ${option.label.toLowerCase()} mode`}
              accessibilityState={{ checked: selected }}
              style={[
                styles.option,
                selected && {
                  backgroundColor: palette.background,
                  borderColor: palette.border,
                },
              ]}
            >
              <MaterialIcons
                name={option.icon}
                size={16}
                color={selected ? palette.text : palette.mutedText}
              />
              <Text
                style={[
                  styles.optionText,
                  { color: selected ? palette.text : palette.mutedText },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 10000,
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    gap: 6,
    boxShadow: '0px 12px 28px rgba(15, 23, 42, 0.18)',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  segmented: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  option: {
    minWidth: 88,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
