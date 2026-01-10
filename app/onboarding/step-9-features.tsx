import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/Colors';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View, useColorScheme } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import OnboardingLayout from './components/OnboardingLayout';

export default function Step9Features() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const { registerPushToken, user } = useAuth();
  const [locationEnabled, setLocationEnabled] = useState(false);
  // Push notifications can't be provisioned on iOS Simulator, so default to off there
  const [notificationsEnabled, setNotificationsEnabled] = useState(Device.isDevice);
  const [saving, setSaving] = useState(false);

  const isDevice = Device.isDevice;

  // CRITICAL: Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.replace('/sign-in');
    }
  }, [user, router]);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  useEffect(() => {
    let cancelled = false;
    // Skip auto-registration on simulators or when the toggle is off
    if (!notificationsEnabled || !isDevice) return;

    void (async () => {
      const granted = await registerPushToken();
      if (!cancelled && !granted) {
        setNotificationsEnabled(false);
        Alert.alert(
          'Notifications Disabled',
          'We could not enable push notifications. You can turn them on later from device settings.'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [notificationsEnabled, registerPushToken, isDevice]);

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
    } catch {
      Alert.alert('Error', 'Unable to request location permission. You can enable this later in settings.');
    }
  };

  const handleNotificationsToggle = useCallback(
    (value: boolean) => {
      if (value && !isDevice) {
        // Simulators can't receive push tokens; avoid failing the flow with a noisy alert
        Alert.alert(
          'Device Required',
          'Push notifications can only be enabled on a physical device. Please test on an iPhone or Android phone.'
        );
        setNotificationsEnabled(false);
        return;
      }

      setNotificationsEnabled(value);
      
      if (value) {
        // Request permissions asynchronously without blocking UI
        registerPushToken().then((granted) => {
          if (!granted) {
            setNotificationsEnabled(false);
            Alert.alert(
              'Notifications Disabled',
              'We could not enable push notifications. You can turn them on later from device settings.'
            );
          }
        }).catch(() => {
          setNotificationsEnabled(false);
        });
      }
    },
    [isDevice, registerPushToken]
  );

  const onContinue = async () => {
    setSaving(true);
    try {
      // Save to context - IMPORTANT: Also save messaging_policy_accepted
      setOB((prev) => ({ 
        ...prev, 
        location_enabled: locationEnabled,
        notifications_enabled: notificationsEnabled,
        messaging_policy_accepted: true
      }));
      
      // Save to backend
      await User.updatePreferences({ 
        location_enabled: locationEnabled,
        notifications_enabled: notificationsEnabled
      });
      
      // For fans, complete onboarding and go to feed
      if (ob.role === 'fan') {
        // Mark onboarding complete for fans - only send defined fields
        const payload: any = {
          messaging_policy_accepted: true,
          location_enabled: locationEnabled,
          notifications_enabled: notificationsEnabled,
        };
        
        // Only add fields that exist in onboarding state
        if (ob.role) payload.role = ob.role;
        if (ob.username) payload.username = ob.username;
        if (ob.display_name) payload.display_name = ob.display_name;
        if (ob.dob) payload.dob = ob.dob;
        if (ob.zip) payload.zip = ob.zip;
        if (ob.zip_code) payload.zip_code = ob.zip_code;
        if (ob.avatar_url) payload.avatar_url = ob.avatar_url;
        if (ob.bio) payload.bio = ob.bio;
        if (ob.sports_interests?.length) payload.sports_interests = ob.sports_interests;
        if (ob.primary_intents?.length) payload.primary_intents = ob.primary_intents;
        if (ob.personalization_goals?.length) payload.personalization_goals = ob.personalization_goals;
        
        await User.completeOnboarding(payload);
        
        // CRITICAL: Validate server confirmed completion
        const updatedUser: any = await User.me();
        if (updatedUser?.preferences?.onboarding_completed !== true) {
          throw new Error('Server did not confirm onboarding completion');
        }
        
        // Success - navigate to feed
        router.replace('/(tabs)/feed');
        return; // Fans are done; skip coach-only confirmation screen
      }
      
      // For coaches, go to confirmation page
      setProgress(7);
      await AsyncStorage.setItem('@onboarding_progress', '8');
      router.replace('/onboarding/step-10-confirmation');
    } catch (e: any) {
      Alert.alert('Failed to save settings', e?.message || 'Please try again');
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <OnboardingLayout
      step={8}
      title="Explore Features"
      subtitle="Configure your privacy and notification preferences"
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Location Access - Player 1 Blue */}
      <View style={[styles.featureCard, styles.blueCard]}>
          <View style={styles.featureHeader}>
            <View style={[styles.featureIconContainer, styles.blueIconContainer]}>
              <Ionicons name="location" size={24} color="#ffffff" />
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
                true: '#3b82f6' 
              }}
              thumbColor={Colors[colorScheme].background}
            />
          </View>
        </View>

        {/* Push Notifications - Player 2 Red */}
        <View style={[styles.featureCard, styles.redCard]}>
          <View style={styles.featureHeader}>
            <View style={[styles.featureIconContainer, styles.redIconContainer]}>
              <Ionicons name="notifications" size={24} color="#ffffff" />
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
              onValueChange={handleNotificationsToggle}
              trackColor={{ 
                false: Colors[colorScheme].border, 
                true: '#ef4444' 
              }}
              thumbColor={Colors[colorScheme].background}
            />
          </View>
        </View>

        {/* Continue Button */}
        <View style={styles.continueSection}>
          <PrimaryButton 
            label={saving ? 'Saving Settings...' : 'Continue'} 
            onPress={onContinue} 
            disabled={saving} 
            loading={saving} 
          />
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
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors[colorScheme].border,
  },
  blueCard: {
    borderColor: '#3b82f6',
    backgroundColor: colorScheme === 'dark' ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
  },
  redCard: {
    borderColor: '#ef4444',
    backgroundColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)',
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
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueIconContainer: {
    backgroundColor: '#3b82f6',
  },
  redIconContainer: {
    backgroundColor: '#ef4444',
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
