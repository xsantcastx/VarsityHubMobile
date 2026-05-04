import CoachAccessRedirecting from '@/components/CoachAccessRedirecting';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, useRootNavigationState } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireCoach } from '@/hooks/useRequireCoach';

export default function ManageTeamsRedirectScreen() {
  const navigationState = useRootNavigationState();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { canAccessCoachTools, loading } = useRequireCoach();

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

  if (canAccessCoachTools && navigationState?.key) {
    return <Redirect href={'/organization?tab=teams' as never} />;
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
