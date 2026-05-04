import { Team } from '@/api/entities';
import type { TeamResponse } from '@/api/schemas/team';
import CoachAccessRedirecting from '@/components/CoachAccessRedirecting';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireCoach } from '@/hooks/useRequireCoach';
import { Redirect, Stack, useRootNavigationState, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

function buildOrganizationOverviewRoute(orgId: string): Href {
  return `/organization?id=${encodeURIComponent(orgId)}&tab=overview` as Href;
}

function buildTeamAdminOverviewRoute(teamId: string): Href {
  return `/team-admin?teamId=${encodeURIComponent(teamId)}&tab=overview` as Href;
}

export default function TeamHubRedirectScreen() {
  const { user } = useAuth();
  const { canAccessCoachTools, loading } = useRequireCoach();
  const navigationState = useRootNavigationState();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [targetRoute, setTargetRoute] = useState<Href | null>(null);

  useEffect(() => {
    let active = true;
    const redirect = async () => {
      if (loading || !canAccessCoachTools) return;

      const orgId = user?.preferences?.organization_id;
      if (orgId) {
        if (active) setTargetRoute(buildOrganizationOverviewRoute(orgId));
        return;
      }

      try {
        const managedTeams = await Team.managed();
        if (!active) return;
        const firstTeam: TeamResponse | null = Array.isArray(managedTeams) ? managedTeams[0] : null;
        if (firstTeam?.id) {
          setTargetRoute(buildTeamAdminOverviewRoute(String(firstTeam.id)));
          return;
        }
      } catch {
        // Fall through.
      }

      if (active) setTargetRoute('/(tabs)');
    };

    void redirect();
    return () => {
      active = false;
    };
  }, [canAccessCoachTools, loading, user?.preferences?.organization_id]);

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
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (!canAccessCoachTools) {
    return (
      <CoachAccessRedirecting
        backgroundColor={theme.background}
        spinnerColor={theme.tint}
        textColor={theme.mutedText}
      />
    );
  }

  if (targetRoute && navigationState?.key) {
    return <Redirect href={targetRoute} />;
  }

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
