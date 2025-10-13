import { OBProvider, useOnboarding } from '@/context/OnboardingContext';
import { Slot } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

function OnboardingProgressBar({ total = 10 }: { total?: number }) {
  const { progress } = useOnboarding();
  const pct = Math.max(0, Math.min(1, total > 0 ? (progress + 1) / total : 0));
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTextRow}>
        <Text style={styles.progressText}>{`Step ${Math.min(progress + 1, total)} of ${total}`}</Text>
      </View>
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>
    </View>
  );
}

export default function OnboardingLayout() {
  return (
    <SafeAreaProvider>
      <OBProvider>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <OnboardingProgressBar total={10} />
        </SafeAreaView>
        <Slot />
      </OBProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F9FAFB' },
  progressWrap: { padding: 12, backgroundColor: '#F9FAFB', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  progressTextRow: { marginBottom: 6 },
  progressText: { fontWeight: '600', color: '#374151' },
  progressBarBackground: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#0A84FF' },
});
