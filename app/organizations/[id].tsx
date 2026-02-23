import { findSeedOrganization, seedOrganizationToPayload } from '@/data/seedOrganizations';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useOrganization } from '@/hooks/useOrganization';

export default function OrganizationDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const normalizedId = useMemo(() => {
    const raw = params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.id]);
  const router = useRouter();
  const seedOrg = useMemo(() => findSeedOrganization(normalizedId), [normalizedId]);
  const seedData = useMemo(
    () => (seedOrg ? seedOrganizationToPayload(seedOrg) : null),
    [seedOrg]
  );
  const { org, loading, error } = useOrganization(normalizedId ?? undefined, seedData ?? undefined);

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
          onPress={handleContactPress}
          style={{ backgroundColor: '#111', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff' }}>Contact</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/request-join-organization', params: { orgId: org.id } } as any)}
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
