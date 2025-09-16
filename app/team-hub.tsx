import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import PrimaryButton from '@/ui/PrimaryButton';
import { Color, Radius, Type } from '@/ui/tokens';

export default function TeamHubScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'team'|'create'|'approvals'>('team');
  const [query, setQuery] = useState('');

  return (
    <SafeAreaView style={S.page} edges={['top']}>
      <Stack.Screen options={{ title: 'Discover' }} />
      <Text style={[Type.h0 as any, { color: Color.text, marginHorizontal: 16, marginTop: 8, marginBottom: 12 }]}>Discover</Text>

      {/* Search */}
      <View style={S.searchWrap}>
        <Ionicons name="search" size={18} color={Color.placeholder} style={{ marginRight: 8 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search for teams, players, or events."
          placeholderTextColor={Color.placeholder}
          style={S.searchInput}
        />
      </View>

      {/* Tabs */}
      <View style={S.tabsWrap}>
        <Pressable onPress={() => setActiveTab('team')} style={[S.tab, activeTab==='team' && S.tabOn]}>
          <Text style={[S.tabLabel, activeTab==='team' && S.tabLabelOn]}>Team Hub</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('create')} style={[S.tab, activeTab==='create' && S.tabOn]}>
          <Text style={[S.tabLabel, activeTab==='create' && S.tabLabelOn]}>Create Event</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('approvals')} style={[S.tab, activeTab==='approvals' && S.tabOn]}>
          <Text style={[S.tabLabel, activeTab==='approvals' && S.tabLabelOn]}>Approvals</Text>
        </Pressable>
      </View>

      {/* Team Management Card */}
      <View style={S.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={S.iconTile}><Ionicons name="shield-checkmark" size={24} color={Color.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.h1 as any, { color: Color.text }]}>Team Management</Text>
            <Text style={[Type.sub as any]}>Create new teams and manage existing ones.</Text>
          </View>
        </View>

        <View style={S.dashedBox}>
          <Text style={{ fontWeight: '800', color: Color.text, marginBottom: 4 }}>You are not managing any teams yet.</Text>
          <Text style={[Type.sub as any, { textAlign: 'center', marginBottom: 12 }]}>Create a team to get started.</Text>
          <PrimaryButton label="Create New Team" onPress={() => router.push('/onboarding/step-5-league')} />
        </View>
      </View>

      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12 }}>
        <Ionicons name="calendar" size={18} color={Color.primary} />
        <Text style={[Type.h2 as any, { color: Color.text }]}>Next Events</Text>
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: Color.pageBg },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 48, marginHorizontal: 16, borderRadius: Radius.md,
    backgroundColor: Color.surface, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Color.border,
  },
  searchInput: { flex: 1, color: Color.text },
  tabsWrap: {
    flexDirection: 'row', backgroundColor: Color.tabBg, borderRadius: Radius.md,
    marginHorizontal: 16, marginTop: 12, padding: 6, gap: 6, height: 40,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  tabOn: { backgroundColor: Color.surface, borderWidth: 1, borderColor: Color.border },
  tabLabel: { fontWeight: '700', color: '#374151' },
  tabLabelOn: { color: Color.text },
  card: {
    margin: 16, padding: 16, borderRadius: Radius.lg, backgroundColor: Color.surface,
    borderWidth: 1, borderColor: Color.border, gap: 12,
  },
  iconTile: { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Color.infoTile },
  dashedBox: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: Color.borderMuted, borderRadius: Radius.md,
    padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 180, marginTop: 8,
  },
});

