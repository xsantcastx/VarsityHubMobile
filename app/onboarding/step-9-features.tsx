import { Colors } from '@/constants/Colors';
import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { OnboardingBackHeader } from '@/components/onboarding/OnboardingBackHeader';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View, useColorScheme } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';
import * as Location from 'expo-location';
import { OnboardingLayout } from './components/OnboardingLayout';

export default function Step9Features() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [messagingAccepted, setMessagingAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  const returnToConfirmation = params.returnToConfirmation === 'true';

  // Calculate user age for messaging policy
  const userAge = useMemo(() => {
    if (!ob.dob) return null;
    const birthDate = new Date(ob.dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1;
    }
    return age;
  }, [ob.dob]);

  const isMinor = userAge !== null && userAge < 17;

  // Messaging policy text based on age and role
  const messagingPolicyText = useMemo(() => {
    if (ob.role === 'coach') {
      return 'As a coach/organizer, you can message all users. You agree to use messaging responsibly and in accordance with our community guidelines.';
    } else if (isMinor) {
      return 'As a minor (under 17), you can only message other minors. This helps ensure a safe environment for young athletes.';
    } else {
      return 'You can message all users on the platform. Please use messaging respectfully and follow our community guidelines.';
    }
  }, [ob.role, isMinor]);

  const enableLocation = async () => {
    if (locationEnabled) {
      setLocationEnabled(false);
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationEnabled(true);
      } else {
        Alert.alert(
          'Permission Denied', 
          'Location access is needed to find local games and events. You can enable this later in your device settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert('Error', 'Unable to request location permission. You can enable this later in settings.');
    }
  };

  const onContinue = async () => {
    if (!messagingAccepted) {
      Alert.alert(
        'Messaging Policy Required',
        'You must accept the messaging policy to continue using VarsityHub.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSaving(true);
    try {
      // Save to context
      setOB((prev) => ({ 
        ...prev, 
        location_enabled: locationEnabled,
        notifications_enabled: notificationsEnabled,
        messaging_policy_accepted: messagingAccepted
      }));
      
      // Save to backend
      await User.updatePreferences({ 
        location_enabled: locationEnabled,
        notifications_enabled: notificationsEnabled,
        messaging_policy_accepted: messagingAccepted
      });
      
      // Save progress to AsyncStorage before navigation
      setProgress(9);
      await AsyncStorage.setItem('@onboarding_progress', '9');
      
      router.replace('/onboarding/step-10-confirmation');
    } catch (e: any) {
      Alert.alert('Failed to save settings', e?.message || 'Please try again');
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <OnboardingLayout
      step={9}
      title="Enable Features"
      subtitle="Configure your privacy and notification preferences"
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Location Access */}
      <View style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="location" size={24} color={Colors[colorScheme].tint} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Location Access</Text>
              <Text style={styles.featureDescription}>
                Find local games, teams, and events near you
              </Text>
              <Text style={styles.featureOptional}>(Optional)</Text>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={enableLocation}
              trackColor={{ 
                false: Colors[colorScheme].border, 
                true: Colors[colorScheme].tint 
              }}
              thumbColor={Colors[colorScheme].background}
            />
          </View>
        </View>

        {/* Push Notifications */}
        <View style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="notifications" size={24} color={colorScheme === 'dark' ? '#4ade80' : '#059669'} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Push Notifications</Text>
              <Text style={styles.featureDescription}>
                Get notified about game updates, messages, and important announcements
              </Text>
              <Text style={styles.featureOptional}>(Optional)</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ 
                false: Colors[colorScheme].border, 
                true: colorScheme === 'dark' ? '#4ade80' : '#059669' 
              }}
              thumbColor={Colors[colorScheme].background}
            />
          </View>
        </View>

        {/* Messaging Policy */}
        <View style={[styles.featureCard, styles.requiredCard]}>
          <View style={styles.featureHeader}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="chatbubble" size={24} color={colorScheme === 'dark' ? '#f87171' : '#DC2626'} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Messaging Policy</Text>
              <Text style={styles.featureDescription}>
                {messagingPolicyText}
              </Text>
              <Text style={styles.featureRequired}>(Required)</Text>
            </View>
          </View>
          
          <View style={styles.policyAgreement}>
            <Pressable 
              style={styles.checkboxContainer}
              onPress={() => setMessagingAccepted(!messagingAccepted)}
            >
              <View style={[styles.checkbox, messagingAccepted && styles.checkboxChecked]}>
                {messagingAccepted && (
                  <Ionicons name="checkmark" size={16} color={Colors[colorScheme].background} />
                )}
              </View>
              <Text style={styles.checkboxLabel}>
                I understand and agree to the messaging policy
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Safety Notice for Minors */}
        {isMinor && (
          <View style={styles.safetyNotice}>
            <Ionicons name="shield-checkmark" size={20} color={colorScheme === 'dark' ? '#4ade80' : '#059669'} />
            <Text style={styles.safetyNoticeText}>
              VarsityHub prioritizes the safety of young athletes with age-appropriate messaging restrictions.
            </Text>
          </View>
        )}

        {/* Continue Button */}
        <View style={styles.continueSection}>
          <PrimaryButton 
            label={saving ? 'Saving Settings...' : 'Continue'} 
            onPress={onContinue} 
            disabled={saving || !messagingAccepted} 
            loading={saving} 
          />
          {!messagingAccepted && (
            <Text style={styles.helpText}>
              You must accept the messaging policy to continue
            </Text>
          )}
        </View>
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors[colorScheme].background 
  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 28 
  },
  title: { 
    ...(Type.h1 as any), 
    color: Colors[colorScheme].text,
    marginBottom: 8, 
    textAlign: 'center' 
  },
  subtitle: { 
    color: Colors[colorScheme].mutedText, 
    marginBottom: 24, 
    textAlign: 'center', 
    fontSize: 16,
    lineHeight: 24
  },
  
  featureCard: {
    backgroundColor: Colors[colorScheme].surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
  },
  requiredCard: {
    borderColor: colorScheme === 'dark' ? '#fca5a5' : '#FCA5A5',
    backgroundColor: colorScheme === 'dark' ? 'rgba(254,242,242,0.1)' : '#FEF2F2',
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors[colorScheme].text,
    marginBottom: 4,
  },
  featureDescription: {
    color: Colors[colorScheme].mutedText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  featureOptional: {
    color: colorScheme === 'dark' ? '#9ca3af' : '#9CA3AF',
    fontSize: 12,
    fontStyle: 'italic',
  },
  featureRequired: {
    color: colorScheme === 'dark' ? '#f87171' : '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  
  policyAgreement: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colorScheme === 'dark' ? 'rgba(243,244,246,0.1)' : '#F3F4F6',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors[colorScheme].border,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors[colorScheme].text,
    borderColor: Colors[colorScheme].text,
  },
  checkboxLabel: {
    flex: 1,
    color: Colors[colorScheme].mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colorScheme === 'dark' ? 'rgba(240,253,244,0.1)' : '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? 'rgba(187,247,208,0.2)' : '#BBF7D0',
  },
  safetyNoticeText: {
    flex: 1,
    marginLeft: 8,
    color: colorScheme === 'dark' ? '#4ade80' : '#166534',
    fontSize: 14,
    lineHeight: 20,
  },
  
  continueSection: {
    marginTop: 24,
  },
  helpText: {
    color: colorScheme === 'dark' ? '#f87171' : '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
});




