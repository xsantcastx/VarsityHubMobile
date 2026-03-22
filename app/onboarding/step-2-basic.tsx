import DateField from '@/components/ui/DateField';
import { Input } from '@/components/ui/input';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding, type Affiliation } from '@/context/OnboardingContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ZipCodeMapPreview } from '@/components/ZipCodeMapPreview';
import { useFocusEffect } from '@react-navigation/native';
import { safeGoBack } from '@/utils/navigation';
import OnboardingLayout from './components/OnboardingLayout';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { uploadFile } from '@/api/upload';

// Username validation: lowercase letters, numbers, dots, underscores only (matches backend)
// Spaces are normalized to underscores BEFORE validation
const usernameRe = /^[a-z0-9_.]+$/;

const SPORT_BALLS = ['⚽', '🎾', '🏈', '🏀'];

function SportBallRow() {
  const [active, setActive] = useState(0);
  const scales = useRef(SPORT_BALLS.map(() => new Animated.Value(0.7))).current;
  const opacities = useRef(SPORT_BALLS.map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    // Animate the first emoji immediately on mount
    Animated.parallel([
      Animated.spring(scales[0], { toValue: 1.2, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacities[0], { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    const interval = setInterval(() => {
      setActive(prev => (prev + 1) % SPORT_BALLS.length);
    }, 800);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- opacities and scales are Animated.Values (ref-like), initial mount only
  }, []);

  useEffect(() => {
    SPORT_BALLS.forEach((_, i) => {
      Animated.parallel([
        Animated.spring(scales[i], {
          toValue: i === active ? 1.2 : 0.7,
          useNativeDriver: true,
          friction: 5,
        }),
        Animated.timing(opacities[i], {
          toValue: i === active ? 1 : 0.35,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- opacities and scales are Animated.Values (ref-like), only active index should trigger
  }, [active]);

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
      {SPORT_BALLS.map((emoji, i) => (
        <Animated.Text
          key={emoji}
          style={{
            fontSize: 28,
            opacity: opacities[i],
            transform: [{ scale: scales[i] }],
          }}
        >
          {emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

export default function Step2Basic() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { markOnboardingCompleteLocally } = useAuth();
  const { state: ob, setState: setOB, setProgress, dispatch, canNavigate } = useOnboarding();
  const [username, setUsername] = useState('');
  const [affiliation, setAffiliation] = useState<Affiliation>('none');
  const [dob, setDob] = useState('');
  const [zip, setZip] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bio, setBio] = useState('');

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  // Check email verification status when screen focuses
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const me: any = await User.me();
          setEmailVerified(me?.email_verified ?? null);
        } catch (error) {
          if (__DEV__) console.warn('[step-2-basic] Failed to check email verification:', error);
          setEmailVerified(null);
        }
      })();
    }, [])
  );

  useEffect(() => { 
    void (async () => { 
      try { 
        const me: any = await User.me();
        // Use username if available, otherwise try to normalize from display_name (legacy)
        const existingUsername = me?.username || '';
        const legacyDisplayName = me?.display_name || '';
        const normalized = existingUsername || legacyDisplayName.trim().toLowerCase().replace(/\s+/g, '_');
        setUsername(normalized);
        setZip(me?.preferences?.zip_code || '');
        
        // Check username availability immediately if it exists
        if (normalized && usernameRe.test(normalized)) {
          try {
            const r: any = await User.usernameAvailable(normalized);
            setAvailable(!!r?.available);
          } catch (error) {
            if (__DEV__) console.warn('[step-2-basic] Username availability check failed:', error);
            setAvailable(null);
          }
        }
      } catch (error) {
        if (__DEV__) console.warn('[step-2-basic] Failed to load user data:', error);
      } 
    })(); 
  }, []);
  useEffect(() => {
    if (ob.affiliation) setAffiliation(ob.affiliation);
    if (ob.dob) setDob(ob.dob || '');
  }, [ob.affiliation, ob.dob]);

  useEffect(() => {
    // Normalize live input (replace spaces with underscores, convert to lowercase)
    // This ensures validation matches backend requirements
    const normalized = username.trim().toLowerCase().replace(/\s+/g, '_');
    if (normalized !== username) {
      setUsername(normalized);
      return; // will re-run effect with normalized value
    }
    // Don't check if username is empty or invalid format
    if (!username || !usernameRe.test(username)) {
      setAvailable(null);
      setChecking(false);
      return;
    }

    // Debounce username checks
    const timeoutId = setTimeout(async () => {
      setChecking(true);
      try {
        const r: any = await User.usernameAvailable(username);
        setAvailable(!!r?.available);
      } catch (error) {
        if (__DEV__) console.warn('[step-2-basic] Username availability check failed:', error);
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [username]);

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err) {
      if (__DEV__) console.warn('[step-2] Avatar pick failed:', err);
    }
  };

  const requestPermissions = async () => {
    // Push notifications — ask with explanation
    try {
      const { status: pushStatus } = await Notifications.getPermissionsAsync();
      if (pushStatus !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    } catch (err) {
      if (__DEV__) console.warn('[step-2] Push permission request failed:', err);
    }
    // Location — ask with explanation
    try {
      const { status: locStatus } = await Location.getForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        await Location.requestForegroundPermissionsAsync();
      }
    } catch (err) {
      if (__DEV__) console.warn('[step-2] Location permission request failed:', err);
    }
  };

  const dobError = dob && (new Date(dob).getFullYear() < 1920 || new Date(dob) > new Date());
  const isUnder13 = dob && (() => {
    const d = new Date(dob);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age < 13;
  })();
  const isUnder18 = dob && (() => {
    const d = new Date(dob);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age < 18;
  })();
  const usernameError = username.length > 0 && !usernameRe.test(username);

  // Validation rules:
  // - Username: required, valid format, available
  // - DOB: required, valid date
  // - Affiliation: required ONLY for coaches (optional for fans)
  // - Zip code: optional for all users
  // - Coaches must be 18+
  const canContinue = usernameRe.test(username) &&
    available !== false &&
    dob &&
    !dobError &&
    !isUnder13 &&
    !(ob.role === 'coach' && isUnder18) &&
    (ob.role === 'fan' || affiliation); // Affiliation required for coaches only

  const onBack = () => {
    setProgress(0);
    safeGoBack(router);
  };

  const onContinue = async () => {
    if (!canContinue) return;

    // COPPA: Block under-13 users - do not store any data
    if (isUnder13) {
      Alert.alert(
        'Age Requirement',
        'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Prevent race conditions
    if (!canNavigate || saving) {
      if (__DEV__) console.warn('[STEP-2] Navigation blocked - saving or already navigating');
      return;
    }
    
    // Final normalization pass
    const finalUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
    setSaving(true);
    dispatch({ type: 'SAVE_START' });
    
    try {
      const updatedData = {
        username: finalUsername,
        affiliation,
        dob,
        zip: zip || undefined,
        zip_code: zip || null,
        step_2_visited: true,
      };

      setOB((prev) => ({
        ...prev,
        ...updatedData,
      }));
      
      // Save username (not display_name) - this is the single identifier
      await User.patchMe({ username: finalUsername, preferences: { affiliation, dob, zip_code: zip || undefined } });
      
      const currentRole = ob.role;
      const updatedDataWithRole = { ...updatedData, role: currentRole };

      if (currentRole === 'coach') {
        // Coaches go to step 3 (league)
        dispatch({ type: 'SAVE_SUCCESS', data: updatedDataWithRole });
        setProgress(2);
        router.replace('/onboarding/step-3-league' as any);
      } else {
        // Fans are DONE — upload avatar, save bio, request permissions, then complete
        try {
          // Upload avatar if selected (non-blocking — don't fail onboarding if upload fails)
          let avatarUrl: string | undefined;
          if (avatarUri) {
            try {
              const uploaded = await uploadFile(avatarUri, 'image');
              avatarUrl = uploaded?.url || uploaded?.secure_url;
            } catch (uploadErr) {
              if (__DEV__) console.warn('[step-2] Avatar upload failed (continuing):', uploadErr);
            }
          }

          // Save bio + avatar before completing onboarding
          if (bio.trim() || avatarUrl) {
            await User.patchMe({
              ...(bio.trim() ? { bio: bio.trim() } : {}),
              ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
            }).catch((err: any) => { if (__DEV__) console.warn('[step-2] Bio/avatar save failed (continuing):', err); });
          }

          await User.completeOnboarding({
            role: 'fan',
            username: finalUsername,
            dob,
            zip_code: zip || undefined,
            affiliation,
          });
          await markOnboardingCompleteLocally();

          // Request push + location permissions (non-blocking)
          await requestPermissions();

          dispatch({ type: 'SAVE_SUCCESS', data: updatedDataWithRole });
          router.replace('/(tabs)' as any);
        } catch (completeErr: any) {
          if (__DEV__) console.error('[step-2] Failed to complete fan onboarding:', completeErr);
          dispatch({ type: 'SAVE_FAIL', error: completeErr });
          Alert.alert('Failed to complete setup', 'Please try again.', [{ text: 'OK' }]);
        }
      }
    } catch (e: any) { 
      if (__DEV__) console.error('[step-2-basic] Failed to save:', e);
      dispatch({ type: 'SAVE_FAIL', error: e });
      const errorMessage = e?.message || e?.data?.error || 'Please try again';
      Alert.alert('Failed to save', errorMessage, [
        { text: 'OK', style: 'default' }
      ]); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <OnboardingLayout
      step={2}
      title="Basic Information"
      subtitle="We'll set up your account with a username and preferences"
      aboveTitle={<SportBallRow />}
      onBack={onBack}
      emailVerified={emailVerified === null ? undefined : emailVerified}
      onVerifyEmail={() => void router.push('/verify')}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Profile Picture (optional) */}
      <Pressable onPress={pickAvatar} style={{ alignSelf: 'center', marginBottom: 16 }} accessibilityLabel="Choose profile picture" accessibilityRole="button">
        <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: Colors[colorScheme].surface, borderWidth: 2, borderColor: Colors[colorScheme].border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={{ width: 90, height: 90 }} />
          ) : (
            <Ionicons name="camera-outline" size={32} color={Colors[colorScheme].mutedText} />
          )}
        </View>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 4 }]}>Add photo</Text>
      </Pressable>

      <Text style={styles.label}>Username</Text>
      <Input value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username" style={{ marginBottom: 4, letterSpacing: 0 }} onEndEditing={async () => {
        if (!usernameRe.test(username)) { setAvailable(null); return; }
        try { const r: any = await User.usernameAvailable(username); setAvailable(!!r?.available); } catch (error) { if (__DEV__) console.warn('[onboarding] Username availability check failed:', error); setAvailable(null); }
      }} />
      {usernameError ? (
        <Text style={styles.error}>Use 3-20 lowercase letters, numbers, underscores, or periods.</Text>
      ) : checking ? (
        <Text style={styles.muted}>Checking availability…</Text>
      ) : available === false ? (
        <Text style={styles.error}>That username is taken</Text>
      ) : available === true && username.length > 0 ? (
        <Text style={styles.success}>Available!</Text>
      ) : null}

      {/* Organization Type - Only shown for coaches/organizers */}
      {ob.role === 'coach' && (
        <>
          <Text style={styles.label}>Organization Type</Text>
          <Text style={[styles.hint, { color: Colors[colorScheme].mutedText }]}>
            Select the type of organization you're affiliated with (optional)
          </Text>
          <View style={styles.affiliationGrid}>
            {[
              { value: 'none', label: 'None', icon: '❌' },
              { value: 'professional', label: 'Professional', icon: '🏟️' },
              { value: 'university', label: 'University', icon: '🎓' },
              { value: 'high_school', label: 'High School', icon: '🏫' },
              { value: 'club', label: 'Club', icon: '⚽' },
              { value: 'youth', label: 'Youth Org', icon: '🏀' },
            ].map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.affiliationButton,
                  affiliation === option.value && styles.affiliationButtonSelected
                ]}
                onPress={() => setAffiliation(option.value as Affiliation)}
                accessibilityLabel={`${option.label} affiliation`}
                accessibilityRole="button"
                accessibilityHint="Double tap to select"
              >
                <Text style={styles.affiliationIcon}>{option.icon}</Text>
                <Text style={[
                  styles.affiliationLabel,
                  affiliation === option.value && styles.affiliationLabelSelected
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <DateField
        label={ob.role === 'coach' ? 'Date of birth (Authorized User)' : 'Date of birth'}
        value={dob} 
        onChange={setDob}
      />
      {dobError && (
        <Text style={styles.error}>Please enter a valid date of birth</Text>
      )}
      {isUnder13 && !dobError && (
        <Text style={styles.error}>VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.</Text>
      )}
      {!isUnder13 && isUnder18 && !dobError && ob.role === 'coach' && (
        <Text style={styles.error}>Coach and organizer accounts require users to be at least 18 years old.</Text>
      )}

      <Text style={styles.label}>Zip code <Text style={styles.muted}>(optional)</Text></Text>
      <Input
        value={zip}
        onChangeText={setZip}
        autoCapitalize="none"
        placeholder="12345"
        keyboardType="numeric"
        maxLength={5}
      />
      <ZipCodeMapPreview zipCode={zip} title="Your Area" subtitle="We'll use this to show you local content near ZIP {zip}" showCircle={false} />

      <Text style={styles.label}>Bio <Text style={styles.muted}>(optional)</Text></Text>
      <TextInput
        value={bio}
        onChangeText={(t) => setBio(t.slice(0, 160))}
        placeholder="Tell us about yourself..."
        placeholderTextColor={Colors[colorScheme].mutedText}
        multiline
        maxLength={300}
        style={{
          minHeight: 60,
          borderWidth: 1,
          borderColor: Colors[colorScheme].border,
          borderRadius: 10,
          padding: 12,
          color: Colors[colorScheme].text,
          backgroundColor: Colors[colorScheme].surface,
          fontSize: 15,
          textAlignVertical: 'top',
        }}
        accessibilityLabel="Bio"
      />
      <Text style={[styles.muted, { textAlign: 'right', fontSize: 12 }]}>{bio.length}/300</Text>

      <View style={{ marginTop: 20 }}>
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={!canContinue}
          loading={saving}
        />
      </View>
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors[colorScheme].background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors[colorScheme].border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors[colorScheme].text,
  },
  title: {
    ...Type.h2,
    color: Colors[colorScheme].text,
    marginBottom: 8,
  },
  subtitle: {
    ...Type.body,
    color: Colors[colorScheme].mutedText,
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors[colorScheme].text,
    marginTop: 12,
    marginBottom: 6,
  },
  error: {
    fontSize: 14,
    color: colorScheme === 'dark' ? '#f87171' : '#ef4444',
    marginTop: 4,
  },
  success: {
    fontSize: 14,
    color: colorScheme === 'dark' ? '#4ade80' : '#22c55e',
    marginTop: 4,
  },
  muted: {
    fontSize: 14,
    color: Colors[colorScheme].mutedText,
    marginTop: 4,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  affiliationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 12,
  },
  affiliationButton: {
    width: '31%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affiliationButtonSelected: {
    borderColor: Colors[colorScheme].tint,
    backgroundColor: colorScheme === 'dark' ? 'rgba(56,189,248,0.1)' : '#EFF6FF',
    borderWidth: 2,
  },
  affiliationIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  affiliationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors[colorScheme].mutedText,
    textAlign: 'center',
  },
  affiliationLabelSelected: {
    color: Colors[colorScheme].tint,
    fontWeight: '700',
  },
});
