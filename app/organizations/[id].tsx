import { Colors } from '@/constants/Colors';
import { useShareLink } from '@/hooks/useShareLink';
import { Organization as OrganizationApi } from '@/api/entities';
import { findSeedOrganization, seedOrganizationToPayload } from '@/data/seedOrganizations';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import { safeGoBack } from '@/utils/navigation';

interface OrgTeam {
  id: string;
  name: string;
  description?: string | null;
  sport?: string | null;
  logo_url?: string | null;
  avatar_url?: string | null;
  _count?: { memberships?: number };
}

interface Organization {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  avatar_url?: string | null;
  profile_picture_url?: string | null;
  formatted_address?: string | null;
  location?: string | null;
  place_id?: string | null;
  zip_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  teams?: OrgTeam[];
  _count?: { teams?: number; memberships?: number };
}

const VALID_ID = /^[a-zA-Z0-9_-]{1,128}$/;

function OrganizationDetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const params = useLocalSearchParams<{ id: string }>();
  const normalizedId = useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const trimmed = raw?.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || !VALID_ID.test(trimmed))
      return null;
    return trimmed;
  }, [params.id]);
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const seedOrg = useMemo(
    () => (normalizedId ? findSeedOrganization(normalizedId) : null),
    [normalizedId]
  );
  const qrCardRef = useRef<ViewShot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!normalizedId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (seedOrg && normalizedId === seedOrg.id) {
          setOrg(seedOrganizationToPayload(seedOrg) as Organization);
          return;
        }
        const data = await OrganizationApi.get(normalizedId);
        if (!cancelled) setOrg(data);
      } catch (e: any) {
        if (!cancelled) {
          if (seedOrg) {
            setOrg(seedOrganizationToPayload(seedOrg) as Organization);
            setError(null);
          } else {
            setError(e.message || 'Error loading organization');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [normalizedId, seedOrg]);

  const locationText = org?.formatted_address || org?.location || null;
  const orgName = org?.name || seedOrg?.name || 'Organization';

  // Section teams by a "Group X" prefix in their description (e.g. World Cup
  // groups). Teams without the prefix render in an untitled trailing section,
  // so orgs that don't use groups keep the original flat list.
  const teamSections = useMemo(() => {
    const teams = org?.teams ?? [];
    const byGroup = new Map<string, OrgTeam[]>();
    const ungrouped: OrgTeam[] = [];
    for (const team of teams) {
      const match = /^(Group\s+[A-Za-z0-9]+)\b/.exec(team.description || '');
      if (match) {
        const key = match[1];
        if (!byGroup.has(key)) byGroup.set(key, []);
        byGroup.get(key)!.push(team);
      } else {
        ungrouped.push(team);
      }
    }
    const sections = [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([title, data]) => ({
        title,
        data: [...data].sort((a, b) => a.name.localeCompare(b.name)),
      }));
    if (ungrouped.length) sections.push({ title: '', data: ungrouped });
    return sections;
  }, [org?.teams]);
  const orgShareId = org?.id || normalizedId || null;
  const orgThemeColor = theme.tint || '#2563EB';
  const {
    share: shareOrganizationLink,
    copyLink: copyOrganizationLink,
    webUrl: orgShareUrl,
  } = useShareLink({
    kind: 'organization',
    id: orgShareId,
    title: org?.name || seedOrg?.name || null,
    contextLines: [locationText],
  });

  const handleLocationPress = () => {
    if (!locationText) return;
    const query = encodeURIComponent(locationText);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      default: `https://maps.google.com/?q=${query}`,
    });
    void Linking.openURL(url).catch(() => {
      void Linking.openURL(`https://maps.google.com/?q=${query}`);
    });
  };

  const handleShareLink = useCallback(async () => {
    await shareOrganizationLink();
  }, [shareOrganizationLink]);

  const handleCopyLink = useCallback(async () => {
    await copyOrganizationLink();
  }, [copyOrganizationLink]);

  const handleSaveQr = useCallback(async () => {
    if (!orgShareUrl || !qrCardRef.current) return;
    try {
      setSavingQr(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Please allow photo access to save the organization QR code.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      const uri = await qrCardRef.current.capture?.();
      if (!uri) {
        Alert.alert('Save failed', 'Unable to generate the organization QR image right now.');
        return;
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'The organization QR code was saved to your photos.');
    } catch (e) {
      if (__DEV__) console.warn('[organization-detail] Failed to save organization QR', e);
      Alert.alert('Save failed', 'Unable to save the organization QR code right now.');
    } finally {
      setSavingQr(false);
    }
  }, [orgShareUrl]);

  // Real (DB) organizations now render on the consolidated /organization screen,
  // which handles public viewers correctly (proper header insets, back button,
  // follow, events). Only seed/demo orgs keep this standalone page. Redirect
  // everything else here too, so deep links / shared /organizations/:id URLs
  // also land on the good screen — not just in-app search.
  if (normalizedId && !seedOrg) {
    return <Redirect href={`/organization?id=${encodeURIComponent(normalizedId)}` as any} />;
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ padding: 16, backgroundColor: theme.background, flex: 1 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 20, fontWeight: '600', color: theme.text }}
        >
          Organization
        </Text>
        <Text style={{ color: '#EF4444', marginTop: 8 }}>{error}</Text>
      </View>
    );
  }
  if (!org) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: theme.background,
        }}
      >
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🏫</Text>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: theme.text }}>
          Not Found
        </Text>
        <Text style={{ color: theme.mutedText, textAlign: 'center', marginBottom: 20 }}>
          This organization doesn't exist or the link is invalid.
        </Text>
        <Pressable
          onPress={() => {
            safeGoBack(router, '/(tabs)/discover');
          }}
          style={{
            backgroundColor: theme.tint,
            borderRadius: 8,
            paddingHorizontal: 20,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleContactPress = async () => {
    const subject = encodeURIComponent(`Organization inquiry: ${org.name}`);
    const body = encodeURIComponent(`Organization ID: ${org.id}\n\nHi VarsityHub team,\n\n`);
    const mailto = `mailto:customerservice@varsityhub.app?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(mailto);
      if (!supported) {
        throw new Error('Mail client unavailable');
      }
      await Linking.openURL(mailto);
    } catch {
      Alert.alert(
        'Contact VarsityHub',
        'Email us at customerservice@varsityhub.app and mention which organization you are contacting about.'
      );
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16 }}
      style={{ backgroundColor: theme.background }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontSize: 24, fontWeight: '700', color: theme.text }}
      >
        {org.name}
      </Text>

      {org.description ? (
        <Text style={{ marginTop: 10, color: theme.text }}>{org.description}</Text>
      ) : null}

      {/* Location */}
      {locationText ? (
        <Pressable
          onPress={handleLocationPress}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}
        >
          <Ionicons name="location-outline" size={16} color={theme.tint} />
          <Text style={{ color: theme.tint }}>{locationText}</Text>
        </Pressable>
      ) : null}

      {/* CTA row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          onPress={handleContactPress}
          style={{
            backgroundColor: colorScheme === 'dark' ? theme.surface : '#111',
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Contact</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          testID="organization-page-share-button"
          onPress={() => setShareModalVisible(true)}
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: theme.text, fontWeight: '600' }}>Share</Text>
        </Pressable>
      </View>

      {/* Teams */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 10 }}>
          Teams
        </Text>
        {org.teams && org.teams.length > 0 ? (
          teamSections.map(section => (
            <View key={section.title || 'ungrouped'}>
              {section.title ? (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: theme.mutedText,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginTop: 14,
                    marginBottom: 4,
                    paddingHorizontal: 12,
                  }}
                >
                  {section.title}
                </Text>
              ) : null}
              {section.data.map(team => (
                <Pressable
                  key={team.id}
                  onPress={() =>
                    router.push({
                      pathname: '/team-page',
                      params: { id: team.id, name: team.name },
                    } as any)
                  }
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: pressed
                      ? colorScheme === 'dark'
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.04)'
                      : 'transparent',
                    borderBottomWidth: 1,
                    borderBottomColor:
                      colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  })}
                >
                  {team.logo_url || team.avatar_url ? (
                    <Image
                      source={{ uri: (team.logo_url || team.avatar_url)! }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="people" size={20} color={theme.mutedText} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>
                      {team.name}
                    </Text>
                    {team.sport ? (
                      <Text style={{ fontSize: 13, color: theme.mutedText, marginTop: 2 }}>
                        {team.sport}
                        {team._count?.memberships ? ` · ${team._count.memberships} members` : ''}
                      </Text>
                    ) : team._count?.memberships ? (
                      <Text style={{ fontSize: 13, color: theme.mutedText, marginTop: 2 }}>
                        {team._count.memberships} members
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.mutedText} />
                </Pressable>
              ))}
            </View>
          ))
        ) : (
          <Text style={{ color: theme.mutedText }}>No teams yet.</Text>
        )}
      </View>
      {/* Members count */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text }}>Members</Text>
        <Text style={{ color: theme.mutedText, marginTop: 6 }}>
          {org._count?.memberships
            ? `${org._count.memberships} member${org._count.memberships === 1 ? '' : 's'}`
            : 'No members yet'}
        </Text>
      </View>

      <Modal
        visible={shareModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 20,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
          }}
        >
          <Pressable
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            onPress={() => setShareModalVisible(false)}
          />
          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.background,
              padding: 20,
              gap: 16,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>
              Share Organization
            </Text>
            <Text style={{ color: theme.mutedText }}>
              Scan or share this code to open the public organization page.
            </Text>

            <ViewShot ref={qrCardRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
              <View
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                }}
              >
                <View
                  style={{
                    backgroundColor: orgThemeColor,
                    paddingHorizontal: 20,
                    paddingVertical: 18,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {org.logo_url || org.avatar_url || org.profile_picture_url ? (
                      <Image
                        source={{
                          uri: String(org.logo_url || org.avatar_url || org.profile_picture_url),
                        }}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: 'rgba(255,255,255,0.18)',
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                        }}
                      >
                        <Ionicons name="business-outline" size={28} color="#ffffff" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 20, fontWeight: '700', color: '#ffffff' }}
                      >
                        {orgName}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ marginTop: 2, color: 'rgba(255,255,255,0.82)' }}
                      >
                        VarsityHub organization
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 24 }}>
                  {orgShareUrl ? (
                    <QRCode
                      value={orgShareUrl}
                      size={196}
                      color="#111111"
                      backgroundColor="#ffffff"
                    />
                  ) : null}
                </View>

                <Text
                  style={{
                    paddingHorizontal: 20,
                    paddingBottom: 20,
                    textAlign: 'center',
                    color: theme.mutedText,
                  }}
                >
                  Scan to open this organization page on VarsityHub
                </Text>
              </View>
            </ViewShot>

            {orgShareUrl ? (
              <Text numberOfLines={2} style={{ color: theme.mutedText }}>
                {orgShareUrl}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => void handleShareLink()}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  backgroundColor: theme.tint,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Share link</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleCopyLink()}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>Copy link</Text>
              </Pressable>
            </View>

            <Pressable
              testID="organization-page-save-qr-button"
              onPress={() => void handleSaveQr()}
              disabled={savingQr}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: savingQr ? 0.6 : 1,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                {savingQr ? 'Saving...' : 'Save QR to Photos'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default OrganizationDetailScreen;
