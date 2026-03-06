import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
// @ts-ignore
import { Team } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingLayout from './components/OnboardingLayout';

const SPORTS = ['Basketball', 'Football', 'Soccer', 'Baseball', 'Tennis', 'Volleyball', 'Swimming', 'Track & Field', 'Other'];

export default function Step5Team() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const colorScheme = useColorScheme() ?? 'light';
  const [teamName, setTeamName] = useState(ob.team_name || '');
  const [sport, setSport] = useState(ob.sport || '');
  const [customSport, setCustomSport] = useState('');
  const [saving, setSaving] = useState(false);

  // If team already exists, skip ahead
  useEffect(() => {
    if (ob.team_id) {
      if (returnToConfirmation) {
        router.replace('/onboarding/step-10-confirmation');
      } else {
        setProgress(5);
        router.replace('/onboarding/step-6-authorized-users');
      }
    }
  }, [ob.team_id, returnToConfirmation, router, setProgress]);

  // Redirect fans — this step is coach-only
  useEffect(() => {
    if (ob.role === 'fan') {
      router.replace('/onboarding/step-7-profile');
    }
  }, [ob.role, router]);

  const effectiveSport = sport === 'Other' ? customSport.trim() : sport;
  const canSubmit = teamName.trim().length >= 2 && effectiveSport.length > 0 && !saving;

  const onContinue = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const created: any = await Team.create({
        name: teamName.trim(),
        sport: effectiveSport,
        organization_id: ob.organization_id || undefined,
        onboarding: true,
      });

      setOB((prev) => ({
        ...prev,
        team_id: created?.id,
        team_name: created?.name || teamName.trim(),
        sport: effectiveSport,
      }));

      setProgress(5);
      if (returnToConfirmation) {
        router.replace('/onboarding/step-10-confirmation');
      } else {
        router.replace('/onboarding/step-6-authorized-users');
      }
    } catch (e: any) {
      const msg = e?.data?.error || e?.message || 'Failed to create team. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  return (
    <OnboardingLayout
      step={5}
      title="Create Your Team"
      subtitle="Set up your first team to get started"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.content}>
        <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Team Name</Text>
        <TextInput
          style={[styles.input, { color: Colors[colorScheme].text, borderColor: Colors[colorScheme].border, backgroundColor: colorScheme === 'dark' ? '#111827' : '#fff' }]}
          value={teamName}
          onChangeText={setTeamName}
          placeholder="e.g. Westside Warriors"
          placeholderTextColor={Colors[colorScheme].mutedText}
          maxLength={60}
          autoFocus
        />

        <Text style={[styles.label, { color: Colors[colorScheme].text, marginTop: 20 }]}>Sport</Text>
        <View style={styles.sportGrid}>
          {SPORTS.map((s) => (
            <Pressable
              key={s}
              style={[
                styles.sportChip,
                { borderColor: sport === s ? Colors[colorScheme].tint : Colors[colorScheme].border,
                  backgroundColor: sport === s ? (colorScheme === 'dark' ? '#1E3A5F' : '#EFF6FF') : 'transparent' },
              ]}
              onPress={() => { setSport(s); if (s !== 'Other') setCustomSport(''); }}
            >
              <Text style={[styles.sportChipText, { color: sport === s ? Colors[colorScheme].tint : Colors[colorScheme].text }]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        {sport === 'Other' && (
          <TextInput
            style={[styles.input, { color: Colors[colorScheme].text, borderColor: Colors[colorScheme].border, backgroundColor: colorScheme === 'dark' ? '#111827' : '#fff', marginTop: 12 }]}
            value={customSport}
            onChangeText={setCustomSport}
            placeholder="Enter your sport"
            placeholderTextColor={Colors[colorScheme].mutedText}
            maxLength={60}
            autoFocus
          />
        )}

        <Pressable
          style={[styles.continueButton, { backgroundColor: canSubmit ? Colors[colorScheme].tint : Colors[colorScheme].border }]}
          onPress={onContinue}
          disabled={!canSubmit}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>Create Team & Continue</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  content: { padding: 16 },
  label: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  sportChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  continueButton: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
