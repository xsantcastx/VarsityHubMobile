import { Input } from '@/components/ui/input';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/Colors';
import { useOnboarding } from '@/context/OnboardingContext';
import { STEP_ROUTES, nextIncompleteStep } from '@/context/onboardingReducer';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import OnboardingLayout from './components/OnboardingLayout';

export default function ParentalConsent() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { state: ob, setState: setOB, setProgress, dispatch, canNavigate } = useOnboarding();
  const [consentChecked, setConsentChecked] = useState(ob.parental_consent_given ?? false);
  const [parentEmail, setParentEmail] = useState(ob.parent_guardian_email ?? '');
  const [saving, setSaving] = useState(false);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  const onBack = () => {
    router.replace('/onboarding/step-2-basic');
  };

  const onContinue = async () => {
    if (!consentChecked || !canNavigate || saving) return;

    setSaving(true);
    dispatch({ type: 'SAVE_START' });

    try {
      // Store consent in user preferences
      await User.patchMe({
        preferences: {
          parental_consent_given: true,
          parent_guardian_email: parentEmail.trim() || undefined,
        },
      });

      setOB((prev) => ({
        ...prev,
        parental_consent_given: true,
        parent_guardian_email: parentEmail.trim() || undefined,
      }));

      // Navigate to the next step after step 2 (same logic step-2 would use)
      const currentRole = ob.role;
      const isCoach = currentRole === 'coach';
      const updatedState = { ...ob, parental_consent_given: true, step_2_visited: true };
      const nextStepIndex = isCoach
        ? 2 // Step 3 (League) for coaches
        : nextIncompleteStep(updatedState, currentRole);
      const nextRoute = isCoach
        ? '/onboarding/step-3-league'
        : (STEP_ROUTES[nextStepIndex] || STEP_ROUTES[0]);

      dispatch({
        type: 'SAVE_SUCCESS',
        data: { parental_consent_given: true, parent_guardian_email: parentEmail.trim() || undefined },
      });
      setProgress(nextStepIndex);
      router.replace(nextRoute as any);
    } catch (e: any) {
      if (__DEV__) console.error('[parental-consent] Failed to save:', e);
      dispatch({ type: 'SAVE_FAIL', error: e });
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingLayout
      step={2}
      title="Parental Consent"
      subtitle="Since you're under 18, a parent or guardian must consent to your use of VarsityHub"
      onBack={onBack}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.infoBox}>
        <MaterialIcons
          name="family-restroom"
          size={32}
          color={Colors[colorScheme].tint}
          style={{ alignSelf: 'center', marginBottom: 12 }}
        />
        <Text style={styles.infoText}>
          VarsityHub requires parental or guardian consent for users under 18, in compliance with our Terms of Service and applicable privacy laws.
        </Text>
        <Text style={[styles.infoText, { marginTop: 8 }]}>
          Please have your parent or guardian review VarsityHub's Terms of Service and Privacy Policy before continuing.
        </Text>
      </View>

      <Text style={styles.label}>
        Parent/Guardian Email <Text style={styles.muted}>(optional)</Text>
      </Text>
      <Input
        value={parentEmail}
        onChangeText={setParentEmail}
        autoCapitalize="none"
        placeholder="parent@example.com"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Text style={styles.hint}>
        Providing an email allows us to contact your parent or guardian if needed.
      </Text>

      <Pressable
        style={styles.checkboxRow}
        onPress={() => setConsentChecked(!consentChecked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consentChecked }}
        accessibilityLabel="I confirm that my parent or guardian has reviewed and consents to my use of VarsityHub"
      >
        <View
          style={[
            styles.checkbox,
            consentChecked && styles.checkboxChecked,
          ]}
        >
          {consentChecked && (
            <MaterialIcons name="check" size={16} color="#FFFFFF" />
          )}
        </View>
        <Text style={styles.checkboxLabel}>
          I confirm that my parent or guardian has reviewed and consents to my use of VarsityHub
        </Text>
      </Pressable>

      <View style={{ marginTop: 20 }}>
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={!consentChecked}
          loading={saving}
        />
      </View>
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    infoBox: {
      backgroundColor: colorScheme === 'dark' ? 'rgba(56,189,248,0.08)' : '#EFF6FF',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colorScheme === 'dark' ? 'rgba(56,189,248,0.2)' : '#BFDBFE',
    },
    infoText: {
      fontSize: 14,
      lineHeight: 21,
      color: Colors[colorScheme].text,
      textAlign: 'center',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors[colorScheme].text,
      marginTop: 12,
      marginBottom: 6,
    },
    muted: {
      fontSize: 14,
      color: Colors[colorScheme].mutedText,
    },
    hint: {
      fontSize: 13,
      color: Colors[colorScheme].mutedText,
      marginTop: 4,
      marginBottom: 16,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginTop: 8,
      paddingVertical: 8,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: Colors[colorScheme].border,
      backgroundColor: Colors[colorScheme].surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
      flexShrink: 0,
    },
    checkboxChecked: {
      backgroundColor: Colors[colorScheme].tint,
      borderColor: Colors[colorScheme].tint,
    },
    checkboxLabel: {
      fontSize: 15,
      lineHeight: 22,
      color: Colors[colorScheme].text,
      flex: 1,
    },
  });
