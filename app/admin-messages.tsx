import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminMessagesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { isAdmin, loading: adminLoading } = useRequireAdmin();

  if (adminLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
        <Text style={{ color: Colors[colorScheme].text, fontSize: 16, fontWeight: '600' }}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Admin · Messages' }} />
      <View style={styles.noticeWrap}>
        <Text style={[styles.noticeTitle, { color: Colors[colorScheme].text }]}>Direct message browsing disabled</Text>
        <Text style={[styles.noticeBody, { color: Colors[colorScheme].mutedText }]}>
          Platform-wide private messages are no longer exposed in the admin UI without report-specific scope.
        </Text>
        <Text style={[styles.noticeBody, { color: Colors[colorScheme].mutedText }]}>
          Use abuse reports for moderation until scoped message review is implemented.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  noticeWrap: { padding: 24, gap: 12 },
  noticeTitle: { fontSize: 18, fontWeight: '800' },
  noticeBody: { fontSize: 14, lineHeight: 20 },
});
