import { Tabs } from 'expo-router';
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
  const hiddenTab = {
    href: null,
  } as const;
  

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { 
          fontSize: 12,
          color: Colors[colorScheme ?? 'light'].text,
        },
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          height: Math.max(64, 56 + insets.bottom),
          paddingBottom: Math.max(10, insets.bottom),
          paddingTop: 6,
          backgroundColor: Colors[colorScheme ?? 'light'].card,
          borderTopColor: Colors[colorScheme ?? 'light'].border,
          borderTopWidth: 1,
        },
      }}>
      <Tabs.Screen
        name="feed/index"
        options={{
          title: 'Feed',
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="square.grid.2x2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="highlights/index"
        options={{
          title: 'Highlights',
          tabBarButton: HapticTab,
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
        name="discover/index"
        options={{
          title: 'Discover',
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
        }}
      />
  {/* Hidden screens within (tabs) that should not appear as tabs */}
  <Tabs.Screen name="notifications/index" options={hiddenTab} />
  {/* Hide nested game routes under Feed */}
  <Tabs.Screen name="feed/game/[id]" options={hiddenTab} />
  <Tabs.Screen name="feed/game/index" options={hiddenTab} />
  {/* Hide nested routes under Discover */}
  <Tabs.Screen name="discover/mobile-community" options={hiddenTab} />
  <Tabs.Screen name="discover/game/index" options={hiddenTab} />
  <Tabs.Screen name="discover/game/[id]" options={hiddenTab} />
  <Tabs.Screen name="admin-ads" options={hiddenTab} />
  <Tabs.Screen name="admin-messages" options={hiddenTab} />
  <Tabs.Screen name="admin-teams" options={hiddenTab} />
  <Tabs.Screen name="admin-users" options={hiddenTab} />
  <Tabs.Screen name="admin-user-detail" options={hiddenTab} />
  <Tabs.Screen name="ad-calendar" options={hiddenTab} />
  <Tabs.Screen name="edit-ad" options={hiddenTab} />
  <Tabs.Screen name="game-detail" options={hiddenTab} />
  <Tabs.Screen name="game-photos" options={hiddenTab} />
  <Tabs.Screen name="game-highlights" options={hiddenTab} />
  <Tabs.Screen name="game-reviews" options={hiddenTab} />
  <Tabs.Screen name="my-ads" options={hiddenTab} />
  <Tabs.Screen name="submit-ad" options={hiddenTab} />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarButton: HapticTab,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle" color={color} />,
        }}
      />
    </Tabs>
  );
}



