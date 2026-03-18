import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/ui/BackHeader';

export default function HelpScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const helpItems = [
    { icon: 'email' as const, label: 'Contact Support', subtitle: 'support@varsityhub.app', onPress: () => void Linking.openURL('mailto:support@varsityhub.app') },
    { icon: 'bug-report' as const, label: 'Report a Bug', subtitle: 'Let us know what went wrong', onPress: () => router.push('/report-abuse') },
    { icon: 'description' as const, label: 'Terms of Service', subtitle: 'Review our terms', onPress: () => router.push('/settings/terms-of-service') },
    { icon: 'privacy-tip' as const, label: 'Privacy Policy', subtitle: 'How we handle your data', onPress: () => router.push('/settings/privacy-policy') },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <BackHeader title="Help & Support" backgroundColor={theme.background} textColor={theme.text} borderColor={theme.border} />
      <ScrollView contentContainerStyle={styles.content}>
        {helpItems.map((item, i) => (
          <Pressable key={i} style={[styles.row, { borderColor: theme.border }]} onPress={item.onPress}>
            <MaterialIcons name={item.icon} size={24} color={theme.tint} />
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>{item.label}</Text>
              <Text style={[styles.rowSub, { color: theme.mutedText }]}>{item.subtitle}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.mutedText} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 1 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
});
