import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/shared/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsOfServiceScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Terms of Service & Policies' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="document-text" size={48} color={theme.tint} />
          <Text style={[styles.title, { color: theme.text }]}>Terms of Service & Policies</Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>Last updated: January 2, 2026</Text>
        </View>

        {/* Core Values as bullet points */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <View style={styles.iconRow}>
            <Ionicons name="flag-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Our Core Values</Text>
          </View>
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.cardText, { color: theme.mutedText }]}>• Community</Text>
            <Text style={[styles.cardText, { color: theme.mutedText }]}>• Respect</Text>
            <Text style={[styles.cardText, { color: theme.mutedText }]}>• Integrity</Text>
            <Text style={[styles.cardText, { color: theme.mutedText }]}>• Empowerment</Text>
            <Text style={[styles.cardText, { color: theme.mutedText, marginTop: 8 }]}>We are dedicated to bringing people together, supporting positive sportsmanship, and making local sports legendary. Every user is expected to uphold these values in all interactions.</Text>
          </View>
        </View>
        {/* Contact & Updates as bullet points */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <View style={styles.iconRow}>
            <Ionicons name="mail-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Contact & Updates</Text>
          </View>
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.cardText, { color: theme.mutedText }]}>• For questions or concerns, contact <Text style={{ fontWeight: 'bold', color: theme.text }}>customerservice@varsityhub.app</Text>.</Text>
            <Text style={[styles.cardText, { color: theme.mutedText }]}>• We may update these policies as needed.</Text>
            <Text style={[styles.cardText, { color: theme.mutedText }]}>• Continued use of VarsityHub means you accept the latest version.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginTop: 12 },
  subtitle: { fontSize: 14, marginTop: 4 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 18 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  cardText: { fontSize: 15, lineHeight: 22 },
  iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
});
