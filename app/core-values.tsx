import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function ValueCard({
  isDark,
  icon,
  iconColor,
  title,
  children,
}: {
  isDark: boolean;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  title: string;
  children: ReactNode;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <MaterialIcons name={icon} size={28} color={iconColor} />
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function PlainBulletList({
  color,
  items,
}: {
  color: string;
  items: string[];
}) {
  return (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <Text key={item} style={[styles.bulletPoint, { color }]}>
          {`• ${item}`}
        </Text>
      ))}
    </View>
  );
}

export default function CoreValuesScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme ?? 'light'];
  const bodyTextColor = theme.mutedText;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
      edges={['top', 'bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Core Values',
          headerBackTitle: 'Back',
          headerShown: true,
          headerRight: () => (
            <Pressable
              onPress={() => void router.push('/dm-restrictions')}
              style={styles.headerButton}
            >
              <MaterialIcons
                name="settings"
                size={24}
                color={theme.text}
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Our Mission */}
        <ValueCard
          isDark={isDark}
          icon="flag"
          iconColor={isDark ? '#60A5FA' : '#3B82F6'}
          title="Our Mission"
        >
          <Text style={[styles.cardBody, { color: bodyTextColor }]}>
            VarsityHub is dedicated to bringing high school sports communities together
            in a safe, positive, and inclusive environment. We empower athletes, parents,
            coaches, and fans to connect, celebrate achievements, and support each other
            through every season.
          </Text>
        </ValueCard>

        {/* Safety First */}
        <ValueCard
          isDark={isDark}
          icon="verified-user"
          iconColor={isDark ? '#34D399' : '#10B981'}
          title="Safety First"
        >
          <Text style={[styles.cardBody, { color: bodyTextColor }]}>
            We prioritize the safety of all users, especially minors. Our platform includes:
          </Text>
          <PlainBulletList
            color={bodyTextColor}
            items={[
              '24/7 content moderation and reporting tools',
              'Age-appropriate messaging restrictions',
              'Zero-tolerance policy for harassment and bullying',
              'Verified coach and staff accounts',
            ]}
          />
        </ValueCard>

        {/* Age-Based Messaging */}
        <ValueCard
          isDark={isDark}
          icon="group"
          iconColor="#F59E0B"
          title="Age-Based Messaging"
        >
          <Text style={[styles.cardBody, { color: bodyTextColor }]}>
            To protect minors, our messaging system enforces age-based restrictions:
          </Text>
          <View style={styles.bulletList}>
            <Text style={[styles.bulletPoint, { color: bodyTextColor }]}>
              <Text style={styles.bold}>Users 17 & under:</Text> Can only send direct messages
              to other minors of similar age
            </Text>
            <Text style={[styles.bulletPoint, { color: bodyTextColor }]}>
              <Text style={styles.bold}>Users 18+:</Text> Can only message other adults and
              verified coaches/staff members
            </Text>
            <Text style={[styles.bulletPoint, { color: bodyTextColor }]}>
              <Text style={styles.bold}>Cross-age messaging:</Text> Blocked by default to
              prevent inappropriate contact
            </Text>
          </View>
        </ValueCard>

        {/* Coach Exception */}
        <ValueCard
          isDark={isDark}
          icon="check-circle"
          iconColor={isDark ? '#8B5CF6' : '#7C3AED'}
          title="Coach Exception"
        >
          <Text style={[styles.cardBody, { color: bodyTextColor }]}>
            Verified coaches and staff members have special permissions to communicate with
            their team members:
          </Text>
          <PlainBulletList
            color={bodyTextColor}
            items={[
              'Coaches are automatically placed in group chats with all team members',
              'Group chats allow safe communication between coaches and players of all ages',
              'All coach communications are logged for safety and transparency',
              'Parents can request to be added to team group chats',
            ]}
          />
        </ValueCard>

        {/* DM Settings Button */}
        <Pressable
          style={[
            styles.safeZoneButton,
            {
              backgroundColor: isDark ? '#3B82F6' : '#2563EB',
            },
          ]}
          onPress={() => void router.push('/dm-restrictions')}
        >
          <MaterialIcons name="settings" size={20} color="#FFFFFF" />
          <Text style={styles.safeZoneButtonText}>Manage DM Settings</Text>
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
