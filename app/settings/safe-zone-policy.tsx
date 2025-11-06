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
        {/* Mission Statement */}
        <View style={[styles.missionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.missionHeader, { color: theme.text }]}>OUR MISSION</Text>
          <Text style={[styles.missionText, { color: theme.mutedText }]}>
            VarsityHub is dedicated to bringing communities together to empower athletes, coaches, parents, and fans that make local sports legendary.
          </Text>
        </View>

        {/* Messaging Policy */}
        <View style={[styles.policyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.policyHeader}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="#DC2626" />
            <Text style={[styles.policyTitle, { color: theme.text }]}>
              Messaging Policy
            </Text>
          </View>
          <Text style={[styles.policyText, { color: theme.mutedText }]}>
            To protect minors, our messaging system enforces age-based restrictions:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Ionicons name="person-outline" size={18} color="#3B82F6" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Users 17 & under: Can only send direct messages to others under 18
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="people-outline" size={18} color="#10B981" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Users 18+: Can only message other adults and verified coaches/staff members
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="close-circle" size={18} color="#DC2626" />
              <Text style={[styles.bulletText, { color: theme.mutedText }]}>
                Cross-age messaging: Blocked by default to prevent inappropriate contact
              </Text>
            </View>
          </View>
          <Text style={[styles.policyFootnote, { color: theme.mutedText }]}>
            These limits help maintain VarsityHub as a safe and respectful community.
          </Text>
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
  missionCard: {
    marginBottom: 24,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  missionHeader: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  missionText: {
    fontSize: 16,
    lineHeight: 26,
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
  policyFootnote: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    fontStyle: 'italic',
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
