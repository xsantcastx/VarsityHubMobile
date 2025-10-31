import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';

type OnboardingAction = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  route: string;
  gradient: [string, string];
};

export default function RoleOnboardingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [userRole, setUserRole] = useState<string | null>(null);
  const [zipCode, setZipCode] = useState('');
  const [zipCodeProvided, setZipCodeProvided] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me: any = await User.me();
        setUserRole(me?.role || 'fan');
        
        // Check if zip code is already provided
        const hasZip = me?.zip_code || me?.preferences?.zip_code;
        if (hasZip) {
          setZipCode(hasZip);
          setZipCodeProvided(true);
        }
      } catch {
        setUserRole('fan');
      }
    })();
  }, []);

  const validateZipCode = (zip: string): boolean => {
    // US ZIP code: 5 digits or 5+4 format
    const zipRegex = /^\d{5}(-\d{4})?$/;
    return zipRegex.test(zip.trim());
  };

  const handleSaveZipCode = async () => {
    if (!zipCode.trim()) {
      Alert.alert('ZIP Code Required', 'Please enter your ZIP code to continue.');
      return;
    }

    if (!validateZipCode(zipCode)) {
      Alert.alert('Invalid ZIP Code', 'Please enter a valid US ZIP code (e.g., 12345 or 12345-6789).');
      return;
    }

    setSaving(true);
    try {
      await User.updatePreferences({ zip_code: zipCode.trim() });
      setZipCodeProvided(true);
      Alert.alert('Success', 'Your ZIP code has been saved!');
    } catch (e: any) {
      console.error('Failed to save ZIP code', e);
      Alert.alert('Error', 'Failed to save ZIP code. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Fan-specific actions (no "Add players")
  const fanActions: OnboardingAction[] = [
    {
      icon: 'flash',
      title: 'View Moments',
      description: 'Watch highlights and memorable plays from games',
      route: '/highlights',
      gradient: ['#3b82f6', '#2563eb'],
    },
    {
      icon: 'create',
      title: 'Post Reviews & Highlights',
      description: 'Share your perspective and favorite game moments',
      route: '/create-post',
      gradient: ['#8b5cf6', '#7c3aed'],
    },
    {
      icon: 'heart',
      title: 'Support Creators',
      description: 'Engage with posts and help content reach more fans',
      route: '/feed',
      gradient: ['#ec4899', '#db2777'],
    },
    {
      icon: 'shield',
      title: 'Claim My Team',
      description: 'Follow your team and never miss a game',
      route: '/favorites',
      gradient: ['#10b981', '#059669'],
    },
  ];

  // Rookie (Player) actions - active participation focused
  const rookieActions: OnboardingAction[] = [
    {
      icon: 'people',
      title: 'Join Teams',
      description: 'Find and join teams to start playing',
      route: '/my-team',
      gradient: ['#2563eb', '#1d4ed8'],
    },
    {
      icon: 'calendar',
      title: 'View Schedule',
      description: 'Check your games and practice schedule',
      route: '/feed',
      gradient: ['#7c3aed', '#6d28d9'],
    },
    {
      icon: 'stats-chart',
      title: 'Track Stats',
      description: 'View your performance and team statistics',
      route: '/highlights',
      gradient: ['#059669', '#047857'],
    },
    {
      icon: 'chatbubbles',
      title: 'Team Chat',
      description: 'Stay connected with teammates and coaches',
      route: '/messages',
      gradient: ['#dc2626', '#b91c1c'],
    },
  ];

  if (!userRole) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Welcome' }} />
      </SafeAreaView>
    );
  }

  // Choose actions based on role
  let actions: OnboardingAction[] = [];
  let welcomeTitle = 'Welcome to Varsity Hub! 🎉';
  
  if (userRole === 'fan') {
    actions = fanActions;
    welcomeTitle = 'Welcome, Fan! 🎉';
  } else if (userRole === 'rookie') {
    actions = rookieActions;
    welcomeTitle = 'Welcome, Rookie! 🏀';
  }

  if (actions.length === 0) {
    // For coaches/admins, redirect to appropriate screen
    useEffect(() => {
      if (userRole === 'coach') {
        router.replace('/manage-teams');
      } else {
        router.replace('/feed');
      }
    }, [userRole]);
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'Welcome to Varsity Hub' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            {welcomeTitle}
          </Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
            {zipCodeProvided ? "Here's what you can do on Varsity Hub" : 'First, tell us where you are'}
          </Text>
        </View>

        {!zipCodeProvided ? (
          <View style={[styles.zipCodeSection, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
            <Text style={[styles.zipCodeLabel, { color: Colors[colorScheme].text }]}>
              Your ZIP Code <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <Text style={[styles.zipCodeHint, { color: Colors[colorScheme].mutedText }]}>
              We'll use this to show you local games and ads
            </Text>
            <TextInput
              style={[styles.zipCodeInput, { 
                backgroundColor: Colors[colorScheme].background, 
                borderColor: Colors[colorScheme].border,
                color: Colors[colorScheme].text 
              }]}
              value={zipCode}
              onChangeText={setZipCode}
              placeholder="12345"
              placeholderTextColor={Colors[colorScheme].mutedText}
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
            />
            <Pressable
              style={[styles.saveZipButton, { 
                backgroundColor: zipCode.trim() ? Colors[colorScheme].tint : Colors[colorScheme].border,
                opacity: saving ? 0.6 : 1,
              }]}
              onPress={handleSaveZipCode}
              disabled={saving || !zipCode.trim()}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.saveZipButtonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.actionsGrid}>
              {actions.map((action, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.actionCard,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => router.push(action.route as any)}
                >
                  <LinearGradient
                    colors={action.gradient}
                    style={styles.actionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.iconContainer}>
                      <Ionicons name={action.icon} size={32} color="#fff" />
                    </View>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  </LinearGradient>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.continueButton, { backgroundColor: Colors[colorScheme].tint }]}
              onPress={() => router.replace('/feed')}
            >
              <Text style={styles.continueButtonText}>Continue to Feed</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: { 
    fontSize: 28, 
    fontWeight: '800', 
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: { 
    fontSize: 16,
    textAlign: 'center',
  },
  zipCodeSection: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  zipCodeLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  zipCodeHint: {
    fontSize: 14,
    marginBottom: 16,
  },
  zipCodeInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  saveZipButton: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveZipButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  actionsGrid: {
    gap: 16,
  },
  actionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  actionGradient: {
    padding: 20,
    minHeight: 140,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  actionDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  continueButton: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});

