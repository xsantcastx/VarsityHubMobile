import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SafeZonePolicyScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Safe Zone Policy' }} />
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={56} color={theme.tint} />
          <Text style={[styles.title, { color: theme.text }]}>Safe Zone Policy</Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            VarsityHub's commitment to user safety
          </Text>
        </View>

        {/* DM Policy for Minors */}
        <View style={[styles.policyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.policyHeader}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="#DC2626" />
            <Text style={[styles.policyTitle, { color: theme.text }]}>
              DM Policy for Minors
            </Text>
          </View>
          <Text style={[styles.policyText, { color: theme.mutedText }]}>
            Users 18+ cannot directly message users under 18 for safety reasons.
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Minors can message other minors safely
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Adults can message other adults freely
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="close-circle" size={18} color="#DC2626" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Adults cannot DM minors (exception: verified coaches)
              </Text>
            </View>
          </View>
        </View>

        {/* Coach Exception */}
        <View style={[styles.policyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.policyHeader}>
            <Ionicons name="shield-outline" size={28} color="#F59E0B" />
            <Text style={[styles.policyTitle, { color: theme.text }]}>
              Coach Exception
            </Text>
          </View>
          <Text style={[styles.policyText, { color: theme.mutedText }]}>
            Verified coaches and staff members have special permissions to communicate with their team members:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Ionicons name="people" size={18} color="#F59E0B" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Coaches are automatically placed in group chats with all team members
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="shield-checkmark" size={18} color="#10B981" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Group chats allow safe communication between coaches and verified team members
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="person-add" size={18} color="#F59E0B" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Parents can request to be added to team group chats for visibility
              </Text>
            </View>
          </View>
        </View>

        {/* Anti-Bullying & Respect */}
        <View style={[styles.policyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.policyHeader}>
            <Ionicons name="heart-outline" size={28} color="#8B5CF6" />
            <Text style={[styles.policyTitle, { color: theme.text }]}>
              Anti-Bullying & Respect
            </Text>
          </View>
          <Text style={[styles.policyText, { color: theme.mutedText }]}>
            VarsityHub has zero tolerance for bullying, harassment, or hateful speech.
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Ionicons name="warning" size={18} color="#EF4444" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                No bullying, harassment, or hate speech
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="warning" size={18} color="#EF4444" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                No sharing of explicit or inappropriate content
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="flag" size={18} color="#8B5CF6" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Report violations immediately
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="shield" size={18} color="#8B5CF6" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Violations may result in account suspension
              </Text>
            </View>
          </View>
        </View>

        {/* How to Report */}
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color={theme.tint} />
            <Text style={[styles.infoTitle, { color: theme.text }]}>How to Report Violations</Text>
          </View>
          <Text style={[styles.infoText, { color: theme.mutedText }]}>
            1. Tap the three-dot menu on any message or post{'\n'}
            2. Select "Report Abuse"{'\n'}
            3. Choose the violation type{'\n'}
            4. Our team will review within 24 hours
          </Text>
        </View>

        {/* COPPA Compliance */}
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.complianceText, { color: theme.mutedText }]}>
            These policies ensure VarsityHub complies with COPPA (Children's Online Privacy Protection Act) 
            and App Store safety guidelines.
          </Text>
        </View>

        <Text style={[styles.footer, { color: theme.mutedText }]}>
          Last updated: November 4, 2025
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  policyCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  policyTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  policyText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  bulletList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  infoCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  complianceText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
