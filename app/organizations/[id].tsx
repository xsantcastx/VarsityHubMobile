import { getConfig } from '@/config/env';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

interface Organization {
  id: string;
  name: string;
  description?: string | null;
  formatted_address?: string | null;
  place_id?: string | null;
  zip_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
}

export default function OrganizationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { apiBaseUrl } = getConfig();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/organizations/${id}`);
        if (!res.ok) {
          throw new Error(`Failed to load org (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) setOrg(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Error loading organization');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, apiBaseUrl]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ padding: 16 }}>
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600' }}>Organization</Text>
        <Text style={{ color: 'red', marginTop: 8 }}>{error}</Text>
      </View>
    );
  }
  if (!org) {
    return (
      <View style={{ padding: 16 }}>
        <Text>No organization found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700' }}>{org.name}</Text>
      {org.formatted_address ? (
        <Text style={{ marginTop: 6, color: '#555' }}>{org.formatted_address}</Text>
      ) : null}
      {org.description ? (
        <Text style={{ marginTop: 10 }}>{org.description}</Text>
      ) : null}

      {/* CTA row */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/contact', params: { orgId: org.id } })}
          style={{ backgroundColor: '#111', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff' }}>Contact</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/join-organization', params: { orgId: org.id } })}
          style={{ backgroundColor: '#0066cc', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff' }}>Request to Join</Text>
        </Pressable>
      </View>

      {/* Placeholder sections for teams, upcoming games/events; can be expanded */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>Teams</Text>
        <Text style={{ color: '#777', marginTop: 6 }}>Coming soon</Text>
      </View>
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>Upcoming</Text>
        <Text style={{ color: '#777', marginTop: 6 }}>Games and events from this organization</Text>
      </View>
    </ScrollView>
  );
}
