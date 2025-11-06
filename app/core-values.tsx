import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CoreValuesScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();

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
              onPress={() => router.push('/settings/safe-zone-policy')}
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
          onPress={() => router.push('/settings/safe-zone-policy')}
        >
          <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
          <Text style={styles.safeZoneButtonText}>View Safe Zone Policy</Text>
        </Pressable>
      </ScrollView>
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
});

