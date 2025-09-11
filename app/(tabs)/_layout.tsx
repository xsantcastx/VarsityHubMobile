import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import CenterTabButton from '@/components/ui/CenterTabButton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 12 },
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          height: Math.max(64, 56 + insets.bottom),
          paddingBottom: Math.max(10, insets.bottom),
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="square.grid.2x2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="highlights"
        options={{
          title: 'Highlights',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="video.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarLabel: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => <CenterTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
        }}
      />
      {/* Hidden detail routes to keep tab bar visible when pushed */}
      <Tabs.Screen name="game-detail" options={{ href: null }} />
      <Tabs.Screen name="game-photos" options={{ href: null }} />
      <Tabs.Screen name="game-highlights" options={{ href: null }} />
      <Tabs.Screen name="game-reviews" options={{ href: null }} />
      <Tabs.Screen name="my-ads" options={{ href: null }} />
      <Tabs.Screen name="submit-ad" options={{ href: null }} />
      <Tabs.Screen name="ad-calendar" options={{ href: null }} />
      <Tabs.Screen name="edit-ad" options={{ href: null }} />
      <Tabs.Screen name="admin-ads" options={{ href: null }} />
      <Tabs.Screen name="admin-messages" options={{ href: null }} />
      <Tabs.Screen name="admin-teams" options={{ href: null }} />
      <Tabs.Screen name="admin-users" options={{ href: null }} />
      <Tabs.Screen name="admin-user-detail" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle" color={color} />,
        }}
      />
    </Tabs>
  );
}
