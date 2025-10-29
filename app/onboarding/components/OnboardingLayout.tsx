import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface OnboardingLayoutProps {
  step: number;
  totalSteps?: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  showBackButton?: boolean;
  emailVerified?: boolean;
  onVerifyEmail?: () => void;
}

export function OnboardingLayout({
  step,
  totalSteps = 10,
  title,
  subtitle,
  children,
  onBack,
  showBackButton = true,
  emailVerified,
  onVerifyEmail,
}: OnboardingLayoutProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      // If there's no back history during onboarding, go to step 1
      router.replace('/onboarding/step-1-role');
    }
  };

  const colors = {
    background: isDark ? '#111827' : '#FFFFFF',
    text: isDark ? '#F9FAFB' : '#111827',
    textMuted: isDark ? '#9CA3AF' : '#6B7280',
    border: isDark ? '#374151' : '#E5E7EB',
    headerBg: isDark ? '#1F2937' : '#FFFFFF',
  };

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      edges={['bottom']}
    >
      {/* Header with progress */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
        {showBackButton && step > 1 ? (
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        
        <Text style={[styles.stepIndicator, { color: colors.textMuted }]}>
          Step {step}/{totalSteps}
        </Text>
        
        {/* Verify Email Button (right side) */}
        {emailVerified === false && onVerifyEmail ? (
          <Pressable onPress={onVerifyEmail} style={styles.verifyButton} hitSlop={8}>
            <Ionicons name="mail-outline" size={18} color="#EF4444" />
            <Text style={styles.verifyButtonText}>Verify</Text>
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBarContainer, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <View 
          style={[
            styles.progressBar, 
            { 
              width: `${(step / totalSteps) * 100}%`,
              backgroundColor: isDark ? '#60A5FA' : '#2563EB'
            }
          ]} 
        />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
          )}
        </View>

        {/* Content */}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  verifyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 4,
    width: '100%',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  titleSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
