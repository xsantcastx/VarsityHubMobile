import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

export default function DMCAScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const C = Colors[colorScheme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Copyright & DMCA' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.section, { borderColor: C.border, backgroundColor: C.card }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>DMCA Designated Service Provider</Text>
          <Text style={[styles.body, { color: C.mutedText }]}>
            VarsityHub is registered with the U.S. Copyright Office as a DMCA Designated Service Provider (Registration No. DMCA-1070362).
          </Text>
        </View>

        <View style={[styles.section, { borderColor: C.border, backgroundColor: C.card }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Report Copyright Infringement</Text>
          <Text style={[styles.body, { color: C.mutedText }]}>
            To report copyright infringement, contact our Designated Agent:
          </Text>
          <Text style={[styles.body, { color: C.text, fontWeight: '500', marginTop: 8 }]}>
            {'Name: Emil Mancero-Sanchez\nOrganization: VarsityHub LLC\nEmail: support@varsityhub.app\nWebsite: varsityhub.app\nLocation: Stamford, Connecticut, United States'}
          </Text>
        </View>

        <View style={[styles.section, { borderColor: C.border, backgroundColor: C.card }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>What to Include</Text>
          <Text style={[styles.body, { color: C.mutedText }]}>
            {'Your notice must include:\n\n1. Identification of the copyrighted work you claim is infringed\n2. The specific URL of the infringing content on VarsityHub\n3. Your name, address, phone number, and email\n4. A statement of good faith belief that the use is unauthorized\n5. A statement under penalty of perjury that you are authorized to act on behalf of the rights holder'}
          </Text>
        </View>

        <View style={[styles.section, { borderColor: C.border, backgroundColor: C.card }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Response & Enforcement</Text>
          <Text style={[styles.body, { color: C.mutedText }]}>
            VarsityHub will respond within 24 hours and remove infringing content promptly. Repeat infringers are permanently banned.
          </Text>
        </View>

        <Text style={[styles.footer, { color: C.mutedText }]}>
          VarsityHub respects the intellectual property rights of all sports organizations and their broadcast partners. We are committed to working cooperatively with rights holders to address any concerns promptly.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
