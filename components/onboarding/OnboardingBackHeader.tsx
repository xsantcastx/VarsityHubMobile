import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
};

export function OnboardingBackHeader({ title, subtitle, onBack, rightSlot }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const borderColor = Colors[colorScheme].border;
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    safeGoBack(router, '/onboarding/step-1-role');
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16), borderBottomColor: borderColor, backgroundColor: Colors[colorScheme].background }]}
    >
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#111827" />
        </Pressable>
        <View style={styles.textContainer}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.rightSlot}>{rightSlot}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  rightSlot: {
    width: 40,
    height: 40,
  },
});

