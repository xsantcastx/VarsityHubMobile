import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: 'Settings',
        headerTitleAlign: 'center',
        headerBackTitle: 'Back',
      }}
    />
  );
}
