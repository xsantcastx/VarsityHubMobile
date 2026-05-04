import { Organization } from '@/api/entities';
import type { OrganizationResponse } from '@/api/schemas/organization';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

function buildOrganizationRoute(id: string): Href {
  return `/organization?id=${encodeURIComponent(id)}` as Href;
}

function buildOrganizationsRoute(): Href {
  return '/organizations';
}

export default function LeagueRedirectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];

  useEffect(() => {
    let active = true;

    const redirect = async () => {
      const orgId = typeof params.id === 'string' ? params.id.trim() : '';
      if (orgId) {
        router.replace(buildOrganizationRoute(orgId));
        return;
      }

      const name = typeof params.name === 'string' ? params.name.trim() : '';
      if (name) {
        try {
          const results = await Organization.list(name, 10);
          if (!active) return;
          const match = Array.isArray(results)
            ? results.find(
                (org: OrganizationResponse) =>
                  String(org.name || '').toLowerCase() === name.toLowerCase()
              ) || results[0]
            : null;
          if (match?.id) {
            router.replace(buildOrganizationRoute(String(match.id)));
            return;
          }
        } catch {
          // Fall through to organizations index.
        }
      }

      router.replace(buildOrganizationsRoute());
    };

    void redirect();
    return () => {
      active = false;
    };
  }, [params.id, params.name, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.background,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={theme.tint} />
    </View>
  );
}
