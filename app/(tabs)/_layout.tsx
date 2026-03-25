import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/HapticTab';
import CenterTabButton from '@/components/ui/CenterTabButton';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const hiddenTab = useMemo(
    () =>
      ({
        href: null,
      }) as const,
    []
  );

  const screenOptions = useMemo(() => {
    const palette = Colors[colorScheme ?? 'light'];

    return {
      tabBarActiveTintColor: palette.tint,
      tabBarInactiveTintColor: colorScheme === 'dark' ? '#D1D5DB' : palette.tabIconDefault,
      headerShown: false,
      tabBarHideOnKeyboard: true,
      tabBarShowLabel: true,
      tabBarLabelStyle: {
        fontSize: 12,
      },
      tabBarBackground: () => <TabBarBackground />,
      tabBarStyle: {
        height: Math.max(64, 56 + insets.bottom),
        paddingBottom: Math.max(10, insets.bottom),
        paddingTop: 6,
        backgroundColor: colorScheme === 'dark' ? '#0f172a' : palette.card,
        overflow: 'visible' as const,
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
        borderTopWidth: 0,
      },
    };
  }, [colorScheme, insets.bottom]);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="feed/index"
        options={{
          title: 'Feed',
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="square.grid.2x2.fill" color={color} />,
          tabBarAccessibilityLabel: 'Feed',
        }}
      />
      <Tabs.Screen
        name="highlights/index"
        options={{
          title: 'Highlights',
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="video.fill" color={color} />,
          tabBarAccessibilityLabel: 'Highlights',
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarLabel: '',
          tabBarButton: CenterTabButton,
          tabBarAccessibilityLabel: 'Create',
        }}
      />
      <Tabs.Screen
        name="discover/index"
        options={{
          title: 'Discover',
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
          tabBarAccessibilityLabel: 'Discover',
        }}
      />
  {/* Hidden screens within (tabs) that should not appear as tabs */}
  <Tabs.Screen name="index" options={hiddenTab} />
  <Tabs.Screen name="notifications/index" options={hiddenTab} />
  <Tabs.Screen name="messages/index" options={hiddenTab} />
  {/* Hide nested game routes under Feed */}
  <Tabs.Screen name="feed/game/[id]" options={hiddenTab} />
  <Tabs.Screen name="feed/game/index" options={hiddenTab} />
  {/* Hide nested routes under Discover */}
  <Tabs.Screen name="discover/mobile-community" options={hiddenTab} />
  <Tabs.Screen name="discover/game/index" options={hiddenTab} />
  <Tabs.Screen name="discover/game/[id]" options={hiddenTab} />
  {/* Admin screens - hidden but accessible with tab bar */}
  <Tabs.Screen name="admin-ads" options={hiddenTab} />
  <Tabs.Screen name="admin-messages" options={hiddenTab} />
  <Tabs.Screen name="admin-teams" options={hiddenTab} />
  <Tabs.Screen name="admin-users" options={hiddenTab} />
  <Tabs.Screen name="admin-user-detail" options={hiddenTab} />
  {/* Ad screens - hidden but accessible with tab bar */}
  <Tabs.Screen name="ad-calendar" options={hiddenTab} />
  <Tabs.Screen name="edit-ad" options={hiddenTab} />
  <Tabs.Screen name="my-ads" options={hiddenTab} />
  <Tabs.Screen name="submit-ad" options={hiddenTab} />
  {/* Game/Event screens - hidden but accessible with tab bar */}
  <Tabs.Screen name="game-detail" options={hiddenTab} />
  <Tabs.Screen name="game-photos" options={hiddenTab} />
  <Tabs.Screen name="game-highlights" options={hiddenTab} />
  <Tabs.Screen name="game-reviews" options={hiddenTab} />
  {/* Common navigation screens - hidden but accessible with tab bar */}
  <Tabs.Screen name="create-post" options={hiddenTab} />
  <Tabs.Screen name="team-profile" options={hiddenTab} />
  <Tabs.Screen name="team-hub" options={hiddenTab} />
  <Tabs.Screen name="team-contacts" options={hiddenTab} />
  <Tabs.Screen name="edit-profile" options={hiddenTab} />
  <Tabs.Screen name="create-team" options={hiddenTab} />
  <Tabs.Screen name="edit-team" options={hiddenTab} />
  <Tabs.Screen name="manage-teams" options={hiddenTab} />
  <Tabs.Screen name="my-team" options={hiddenTab} />
  <Tabs.Screen name="followers" options={hiddenTab} />
  <Tabs.Screen name="following" options={hiddenTab} />
  <Tabs.Screen name="organization" options={hiddenTab} />
  <Tabs.Screen name="event-detail" options={hiddenTab} />
  <Tabs.Screen name="edit-event" options={hiddenTab} />
  <Tabs.Screen name="edit-organization" options={hiddenTab} />
  <Tabs.Screen name="event-approvals" options={hiddenTab} />
  <Tabs.Screen name="approvals" options={hiddenTab} />
  <Tabs.Screen name="verify-email" options={hiddenTab} />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle" color={color} />,
          tabBarAccessibilityLabel: 'Profile',
        }}
      />
    </Tabs>
  );
}



