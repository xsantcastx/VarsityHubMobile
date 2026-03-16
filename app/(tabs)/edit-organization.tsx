import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Organization } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import { getApiBaseUrl } from '@/api/http';

const ORG_TYPES = [
  { label: 'School', value: 'school' },
  { label: 'Club', value: 'club' },
  { label: 'League', value: 'league' },
  { label: 'Other', value: 'other' },
];

export default function EditOrganizationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('');
  const [orgType, setOrgType] = useState('');
  const [location, setLocation] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const loadOrg = useCallback(async () => {
    if (!params.id) return;
    try {
      setLoading(true);
      const org: any = await Organization.get(params.id);
      setName(org.name || '');
      setDescription(org.description || '');
      setSport(org.sport || '');
      setOrgType(org.org_type || '');
      setLocation(org.location || '');
      setZipCode(org.zip_code || '');
      setLogoUrl(org.logo_url || null);
    } catch {
      Alert.alert('Error', 'Failed to load organization.');
      if (router.canGoBack()) router.back();
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => { void loadOrg(); }, [loadOrg]);

  const pickLogo = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!r.canceled && r.assets?.[0]) {
        setUploadingLogo(true);
        try {
          const res = await uploadFile(getApiBaseUrl(), r.assets[0].uri, 'org-logo.jpg', 'image/jpeg');
          const url = res?.url || res?.path;
          if (url) setLogoUrl(url);
        } catch (e: any) {
          Alert.alert('Upload Failed', e?.message || 'Could not upload logo.');
        } finally {
          setUploadingLogo(false);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to open image picker.');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Organization name is required.');
      return;
    }
    if (!params.id) return;
    setSaving(true);
    try {
      await Organization.update(params.id, {
        name: name.trim(),
        description: description.trim() || null,
        logo_url: logoUrl || null,
        sport: sport.trim() || null,
        org_type: orgType || null,
        location: location.trim() || null,
        zip_code: zipCode.trim() || null,
      });
      Alert.alert('Saved', 'Organization updated successfully.');
      if (router.canGoBack()) router.back();
    } catch (e: any) {
      const msg = e?.data?.error || e?.message || 'Failed to save changes.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => { if (router.canGoBack()) router.back(); }} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Organization</Text>
        <Pressable onPress={handleSave} disabled={saving} hitSlop={12}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.tint} />
          ) : (
            <Text style={[styles.saveBtn, { color: theme.tint }]}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <Text style={[styles.label, { color: theme.text }]}>Organization Logo</Text>
        <Pressable style={[styles.logoSection, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={pickLogo} disabled={uploadingLogo}>
          {uploadingLogo ? (
            <ActivityIndicator size="small" color={theme.tint} />
          ) : logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoImage} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="camera-outline" size={32} color={theme.mutedText} />
              <Text style={[styles.logoPlaceholderText, { color: theme.mutedText }]}>Tap to add logo</Text>
            </View>
          )}
        </Pressable>
        {logoUrl && (
          <View style={styles.logoActions}>
            <Pressable onPress={pickLogo} style={[styles.logoActionBtn, { backgroundColor: theme.tint }]}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Change</Text>
            </Pressable>
            <Pressable onPress={() => setLogoUrl(null)} style={[styles.logoActionBtn, { backgroundColor: '#EF4444' }]}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Remove</Text>
            </Pressable>
          </View>
        )}

        {/* Name */}
        <Text style={[styles.label, { color: theme.text }]}>Organization Name *</Text>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          value={name}
          onChangeText={setName}
          placeholder="Organization name"
          placeholderTextColor={theme.mutedText}
          autoCapitalize="words"
        />

        {/* Description */}
        <Text style={[styles.label, { color: theme.text }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Tell people about your organization"
          placeholderTextColor={theme.mutedText}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Sport */}
        <Text style={[styles.label, { color: theme.text }]}>Sport</Text>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          value={sport}
          onChangeText={setSport}
          placeholder="e.g., Basketball, Football"
          placeholderTextColor={theme.mutedText}
        />

        {/* Org Type */}
        <Text style={[styles.label, { color: theme.text }]}>Type</Text>
        <View style={styles.chipRow}>
          {ORG_TYPES.map((t) => (
            <Pressable
              key={t.value}
              style={[
                styles.chip,
                {
                  backgroundColor: orgType === t.value ? theme.tint : theme.card,
                  borderColor: orgType === t.value ? theme.tint : theme.border,
                },
              ]}
              onPress={() => setOrgType(orgType === t.value ? '' : t.value)}
            >
              <Text style={{ color: orgType === t.value ? '#fff' : theme.text, fontWeight: '600', fontSize: 14 }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Location */}
        <Text style={[styles.label, { color: theme.text }]}>Location</Text>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          value={location}
          onChangeText={setLocation}
          placeholder="City, State"
          placeholderTextColor={theme.mutedText}
        />

        {/* ZIP Code */}
        <Text style={[styles.label, { color: theme.text }]}>ZIP Code</Text>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          value={zipCode}
          onChangeText={setZipCode}
          placeholder="12345"
          placeholderTextColor={theme.mutedText}
          keyboardType="number-pad"
          maxLength={10}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  saveBtn: { fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: { minHeight: 100 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  logoSection: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  logoPlaceholderText: {
    fontSize: 12,
    fontWeight: '500',
  },
  logoActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  logoActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
