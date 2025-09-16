import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OBProvider } from '@/context/OnboardingContext';

export default function OnboardingLayout() {
  return (
    <SafeAreaProvider>
      <OBProvider>
        <Slot />
      </OBProvider>
    </SafeAreaProvider>
  );
}
