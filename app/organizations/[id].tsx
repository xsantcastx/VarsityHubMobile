import { getConfig } from '@/config/env';
import { Colors } from '@/constants/Colors';
import { httpGet } from '@/api/http';
import { findSeedOrganization, seedOrganizationToPayload } from '@/data/seedOrganizations';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';

interface Organization {
  id: string;
  name: string;
  description?: string | null;
  formatted_address?: string | null;
  location?: string | null;
  place_id?: string | null;
  zip_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  _count?: { teams?: number; memberships?: number };
}

const VALID_ID = /^[a-zA-Z0-9_-]{1,128}$/;

export default function OrganizationDetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const params = useLocalSearchParams<{ id: string }>();
  const normalizedId = useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const trimmed = raw?.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || !VALID_ID.test(trimmed)) return null;
    return trimmed;
  }, [params.id]);
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { apiUrl } = getConfig();
  const seedOrg = useMemo(() => normalizedId ? findSeedOrganization(normalizedId) : null, [normalizedId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!normalizedId) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        if (seedOrg && normalizedId === seedOrg.id) {
          setOrg(seedOrganizationToPayload(seedOrg) as Organization);
          return;
        }
        const data = await httpGet(`/organizations/${normalizedId}`);
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
    return () => { cancelled = true; };
  }, [normalizedId, apiUrl, seedOrg]);

  const locationText = org?.formatted_address || org?.location || null;

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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ padding: 16, backgroundColor: theme.background, flex: 1 }}>
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600', color: theme.text }}>Organization</Text>
        <Text style={{ color: '#EF4444', marginTop: 8 }}>{error}</Text>
      </View>
    );
  }
  if (!org) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.background }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🏫</Text>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: theme.text }}>Not Found</Text>
        <Text style={{ color: theme.mutedText, textAlign: 'center', marginBottom: 20 }}>This organization doesn't exist or the link is invalid.</Text>
        <Pressable onPress={() => { if (router.canGoBack()) router.back(); }} style={{ backgroundColor: theme.tint, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 }}>
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
    <ScrollView contentContainerStyle={{ padding: 16 }} style={{ backgroundColor: theme.background }}>
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700', color: theme.text }}>{org.name}</Text>

      {org.description ? (
        <Text style={{ marginTop: 10, color: theme.text }}>{org.description}</Text>
      ) : null}

      {/* Location */}
      {locationText ? (
        <Pressable onPress={handleLocationPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <Ionicons name="location-outline" size={16} color={theme.tint} />
          <Text style={{ color: theme.tint }}>{locationText}</Text>
        </Pressable>
      ) : null}

      {/* CTA row */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          onPress={handleContactPress}
          style={{ backgroundColor: colorScheme === 'dark' ? theme.surface : '#111', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Contact</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/request-join-organization', params: { orgId: org.id } } as any)}
          style={{ backgroundColor: theme.tint, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Request to Join</Text>
        </Pressable>
      </View>

      {/* Teams count */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text }}>Teams</Text>
        <Text style={{ color: theme.mutedText, marginTop: 6 }}>
          {org._count?.teams ? `${org._count.teams} team${org._count.teams === 1 ? '' : 's'}` : 'No teams yet'}
        </Text>
      </View>
      {/* Members count */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text }}>Members</Text>
        <Text style={{ color: theme.mutedText, marginTop: 6 }}>
          {org._count?.memberships ? `${org._count.memberships} member${org._count.memberships === 1 ? '' : 's'}` : 'No members yet'}
        </Text>
      </View>
    </ScrollView>
  );
}
