import { OBProvider } from '@/context/OnboardingContext';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function OnboardingLayout() {
  return (
    <SafeAreaProvider>
      <OBProvider>
        <Slot />
      </OBProvider>
    </SafeAreaProvider>
  );
}
