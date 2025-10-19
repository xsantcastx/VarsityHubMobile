import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SAFE_ZONE_KEY = 'hasSeenSafeZonePolicy';

export default function CoreValuesScreen() {
  const colorScheme = useColorScheme();
  const [showSafeZoneModal, setShowSafeZoneModal] = useState(false);

  useEffect(() => {
    // Check if user has seen the Safe Zone Policy modal before
    AsyncStorage.getItem(SAFE_ZONE_KEY).then((val) => {
      if (!val) {
        setShowSafeZoneModal(true);
      }
    });
  }, []);

  const handleCloseSafeZone = async () => {
    await AsyncStorage.setItem(SAFE_ZONE_KEY, 'true');
    setShowSafeZoneModal(false);
  };

  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? '#0B1120' : '#FFFFFF' }]}
      edges={['top']}
    >
      <Stack.Screen
        options={{
          title: 'Core Values',
          headerRight: () => (
            <Pressable
              onPress={() => setShowSafeZoneModal(true)}
              style={styles.headerButton}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={24}
                color={isDark ? '#ECEDEE' : '#11181C'}
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Our Mission */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
              borderColor: isDark ? '#374151' : '#E5E7EB',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name="flag-outline"
              size={28}
              color={isDark ? '#60A5FA' : '#3B82F6'}
            />
            <Text style={[styles.cardTitle, { color: isDark ? '#ECEDEE' : '#11181C' }]}>
              Our Mission
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: isDark ? '#D1D5DB' : '#374151' }]}>
            VarsityHub is dedicated to bringing high school sports communities together
            in a safe, positive, and inclusive environment. We empower athletes, parents,
            coaches, and fans to connect, celebrate achievements, and support each other
            through every season.
          </Text>
        </View>

        {/* Safety First */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
              borderColor: isDark ? '#374151' : '#E5E7EB',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name="shield-checkmark"
              size={28}
              color={isDark ? '#34D399' : '#10B981'}
            />
            <Text style={[styles.cardTitle, { color: isDark ? '#ECEDEE' : '#11181C' }]}>
              Safety First
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: isDark ? '#D1D5DB' : '#374151' }]}>
            We prioritize the safety of all users, especially minors. Our platform includes:
          </Text>
          <View style={styles.bulletList}>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              • 24/7 content moderation and reporting tools
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              • Age-appropriate messaging restrictions
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              • Zero-tolerance policy for harassment and bullying
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              • Verified coach and staff accounts
            </Text>
          </View>
        </View>

        {/* Age-Based Messaging */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
              borderColor: isDark ? '#374151' : '#E5E7EB',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name="people-outline"
              size={28}
              color={isDark ? '#F59E0B' : '#F59E0B'}
            />
            <Text style={[styles.cardTitle, { color: isDark ? '#ECEDEE' : '#11181C' }]}>
              Age-Based Messaging
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: isDark ? '#D1D5DB' : '#374151' }]}>
            To protect minors, our messaging system enforces age-based restrictions:
          </Text>
          <View style={styles.bulletList}>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              <Text style={styles.bold}>Users 17 & under:</Text> Can only send direct messages
              to other minors of similar age
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              <Text style={styles.bold}>Users 18+:</Text> Can only message other adults and
              verified coaches/staff members
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              <Text style={styles.bold}>Cross-age messaging:</Text> Blocked by default to
              prevent inappropriate contact
            </Text>
          </View>
        </View>

        {/* Coach Exception */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
              borderColor: isDark ? '#374151' : '#E5E7EB',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name="checkmark-circle"
              size={28}
              color={isDark ? '#8B5CF6' : '#7C3AED'}
            />
            <Text style={[styles.cardTitle, { color: isDark ? '#ECEDEE' : '#11181C' }]}>
              Coach Exception
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: isDark ? '#D1D5DB' : '#374151' }]}>
            Verified coaches and staff members have special permissions to communicate with
            their team members:
          </Text>
          <View style={styles.bulletList}>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              • Coaches are automatically placed in group chats with all team members
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              • Group chats allow safe communication between coaches and players of all ages
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              • All coach communications are logged for safety and transparency
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              • Parents can request to be added to team group chats
            </Text>
          </View>
        </View>

        {/* Safe Zone Button */}
        <Pressable
          style={[
            styles.safeZoneButton,
            {
              backgroundColor: isDark ? '#3B82F6' : '#2563EB',
            },
          ]}
          onPress={() => setShowSafeZoneModal(true)}
        >
          <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
          <Text style={styles.safeZoneButtonText}>View Safe Zone Policy</Text>
        </Pressable>
      </ScrollView>

      {/* Safe Zone Policy Modal */}
      <Modal
        visible={showSafeZoneModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseSafeZone}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseSafeZone}>
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Ionicons
                name="shield-checkmark"
                size={40}
                color={isDark ? '#60A5FA' : '#3B82F6'}
              />
              <Text
                style={[styles.modalTitle, { color: isDark ? '#ECEDEE' : '#11181C' }]}
              >
                Safe Zone Policy
              </Text>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* DM Policy for Minors */}
              <View style={styles.policyItem}>
                <View
                  style={[
                    styles.policyIcon,
                    { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
                  ]}
                >
                  <Ionicons
                    name="lock-closed"
                    size={24}
                    color={isDark ? '#60A5FA' : '#3B82F6'}
                  />
                </View>
                <View style={styles.policyText}>
                  <Text
                    style={[
                      styles.policyTitle,
                      { color: isDark ? '#ECEDEE' : '#11181C' },
                    ]}
                  >
                    DM Policy for Minors
                  </Text>
                  <Text
                    style={[
                      styles.policyDescription,
                      { color: isDark ? '#D1D5DB' : '#6B7280' },
                    ]}
                  >
                    Users 18 and older can only send direct messages to coaches and staff.
                    This protects minors from unsolicited contact with adults.
                  </Text>
                </View>
              </View>

              {/* Coach Exception */}
              <View style={styles.policyItem}>
                <View
                  style={[
                    styles.policyIcon,
                    { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
                  ]}
                >
                  <Ionicons
                    name="people"
                    size={24}
                    color={isDark ? '#34D399' : '#10B981'}
                  />
                </View>
                <View style={styles.policyText}>
                  <Text
                    style={[
                      styles.policyTitle,
                      { color: isDark ? '#ECEDEE' : '#11181C' },
                    ]}
                  >
                    Coach Exception
                  </Text>
                  <Text
                    style={[
                      styles.policyDescription,
                      { color: isDark ? '#D1D5DB' : '#6B7280' },
                    ]}
                  >
                    Verified coaches are automatically placed in group chats with their team
                    members, allowing safe communication with players of all ages.
                  </Text>
                </View>
              </View>

              {/* Anti-Bullying Reminder */}
              <View style={styles.policyItem}>
                <View
                  style={[
                    styles.policyIcon,
                    { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
                  ]}
                >
                  <Ionicons
                    name="hand-left"
                    size={24}
                    color={isDark ? '#F59E0B' : '#F59E0B'}
                  />
                </View>
                <View style={styles.policyText}>
                  <Text
                    style={[
                      styles.policyTitle,
                      { color: isDark ? '#ECEDEE' : '#11181C' },
                    ]}
                  >
                    Anti-Bullying Reminder
                  </Text>
                  <Text
                    style={[
                      styles.policyDescription,
                      { color: isDark ? '#D1D5DB' : '#6B7280' },
                    ]}
                  >
                    VarsityHub has a zero-tolerance policy for hate speech, harassment, or
                    bullying. Users can block and report inappropriate behavior at any time.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <Pressable
              style={[
                styles.gotItButton,
                { backgroundColor: isDark ? '#3B82F6' : '#2563EB' },
              ]}
              onPress={handleCloseSafeZone}
            >
              <Text style={styles.gotItButtonText}>Got it!</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    marginRight: 8,
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletList: {
    marginTop: 8,
    gap: 8,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  safeZoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  safeZoneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 12,
  },
  modalScroll: {
    marginBottom: 20,
  },
  policyItem: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  policyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyText: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  policyDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  gotItButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  gotItButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

